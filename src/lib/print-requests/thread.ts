import type {
  Prisma,
  PrintMessageKind,
  PrintRequestStatus,
  PrintRequestMessage,
  PrintThreadSide,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PrintRequestError } from "./errors";
import { PRINT_REQUEST_STATUS_LABELS, formatFcfa } from "./labels";

export type ThreadEventType =
  | "SUBMITTED"
  | "LINES_CHANGED"
  | "BADGES_CHANGED"
  | "REQUEST_UPDATED"
  | "QUOTE_SENT"
  | "QUOTE_ACCEPTED"
  | "QUOTE_REOPENED"
  | "QUOTE_REVISION"
  | "TEMPLATE_CHANGED"
  | "STATUS_CHANGED"
  | "REJECTED"
  | "CANCELLED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_FAILED"
  | "PAYMENT_UNMATCHED"
  | "SHEETS_GENERATED"
  | "REGISTRATIONS_SKIPPED";

export type ThreadActor = { userId: string | null; side: PrintThreadSide };

const SYSTEM_ACTOR: ThreadActor = { userId: null, side: "SYSTEM" };

export type LineChange = {
  op: "ADDED" | "UPDATED" | "REMOVED";
  lineId: string;
  label: string;
  from?: { quantity: number; unitPrice: number };
  to?: { quantity: number; unitPrice: number };
};

const MAX_BODY_LENGTH = 5000;

export function describeLineChange(c: LineChange): string {
  if (c.op === "ADDED") {
    const to = c.to!;
    return `Ligne ajoutée : ${c.label} (${to.quantity} × ${formatFcfa(to.unitPrice)})`;
  }
  if (c.op === "REMOVED") return `Ligne retirée : ${c.label}`;
  const { from, to } = c as Required<LineChange>;
  const parts: string[] = [];
  if (from.quantity !== to.quantity) parts.push(`quantité ${from.quantity} → ${to.quantity}`);
  if (from.unitPrice !== to.unitPrice) {
    parts.push(`prix unitaire ${formatFcfa(from.unitPrice)} → ${formatFcfa(to.unitPrice)}`);
  }
  return `Ligne modifiée : ${c.label} (${parts.join(", ")})`;
}

const F = (x: unknown) => formatFcfa(Number(x));
const L = (s: unknown) => PRINT_REQUEST_STATUS_LABELS[s as PrintRequestStatus];
const strings = (v: unknown) => (v as unknown[]).map(String);

export function describeThreadEvent(
  eventType: ThreadEventType,
  details: Record<string, unknown>,
): string {
  switch (eventType) {
    case "LINES_CHANGED": {
      const changes = details.changes as LineChange[];
      return changes.length === 1
        ? describeLineChange(changes[0])
        : `${changes.length} lignes modifiées`;
    }
    case "SUBMITTED":
      return `Demande envoyée : ${details.badgeCount} badges, total estimé ${F(details.total)}`;
    case "BADGES_CHANGED": {
      const lagging = strings(details.lagging);
      const base = `Badges de la demande : +${details.added}, −${details.removed} (${details.count} au total)`;
      return lagging.length > 0
        ? `${base} — quantités fixées par l'équipe à vérifier : ${lagging.join(", ")}`
        : base;
    }
    case "REQUEST_UPDATED":
      return `Informations modifiées : ${strings(details.fields).join(", ")}`;
    case "QUOTE_SENT":
      return `Devis v${details.version} envoyé : ${F(details.total)}`;
    case "QUOTE_ACCEPTED":
      return `Devis v${details.version} accepté : ${F(details.total)}`;
    case "QUOTE_REOPENED":
      return `Devis v${details.version} rouvert : l'acceptation est annulée`;
    case "QUOTE_REVISION":
      return "Devis en révision : il sera renvoyé avant acceptation";
    case "TEMPLATE_CHANGED":
      return (
        `Template de badge changé : ${details.fromLabel} → ${details.toLabel}` +
        (details.acceptanceCancelled ? "; l'acceptation est annulée" : "")
      );
    case "STATUS_CHANGED":
      return `Statut : ${L(details.from)} → ${L(details.to)}`;
    case "REJECTED":
      return `Demande refusée : ${details.reason}`;
    case "CANCELLED":
      return "Demande annulée";
    case "PAYMENT_RECEIVED":
      return (
        `Paiement reçu : ${F(details.amount)}` +
        (details.reason ? ` (hors ligne : ${details.reason})` : "")
      );
    case "PAYMENT_FAILED":
      return `Paiement échoué : ${F(details.amount)}`;
    case "PAYMENT_UNMATCHED":
      return `Paiement reçu sans correspondance avec le devis : ${F(details.amount)}`;
    case "SHEETS_GENERATED":
      return `Planches lancées pour ${details.badgeCount} badges`;
    case "REGISTRATIONS_SKIPPED": {
      const ids = strings(details.registrationIds);
      return `${ids.length} badge(s) écarté(s) à la génération (inscription non approuvée) : ${ids.join(", ")}`;
    }
  }
}

// Ajoute une entrée automatique au fil ; les modifications de lignes consécutives du même
// auteur sont regroupées dans la dernière entrée.
export async function appendThreadEvent(
  tx: Prisma.TransactionClient,
  requestId: string,
  eventType: ThreadEventType,
  details: Record<string, unknown>,
  actor: ThreadActor = SYSTEM_ACTOR,
): Promise<PrintRequestMessage> {
  if (eventType === "LINES_CHANGED") {
    const last = await tx.printRequestMessage.findFirst({
      where: { requestId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (
      last &&
      last.kind === "EVENT" &&
      last.eventType === "LINES_CHANGED" &&
      last.side === actor.side &&
      last.authorId === actor.userId
    ) {
      const previous = (last.details as { changes: LineChange[] }).changes;
      const merged = { ...details, changes: [...previous, ...(details.changes as LineChange[])] };
      return tx.printRequestMessage.update({
        where: { id: last.id },
        data: {
          details: merged as unknown as Prisma.InputJsonValue,
          body: describeThreadEvent("LINES_CHANGED", merged),
        },
      });
    }
  }
  return tx.printRequestMessage.create({
    data: {
      requestId,
      authorId: actor.userId,
      side: actor.side,
      kind: "EVENT",
      body: describeThreadEvent(eventType, details),
      eventType,
      details: details as Prisma.InputJsonValue,
    },
  });
}

// Retire les caractères de contrôle (sauf retour à la ligne et tabulation) et les espaces de bord.
function cleanBody(raw: string): string {
  return raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

export async function postMessage(input: {
  requestId: string;
  authorId: string;
  side: "ORGANIZER" | "STAFF";
  body: string;
  attachmentKey: string | null;
}): Promise<PrintRequestMessage> {
  const request = await prisma.printRequest.findUnique({
    where: { id: input.requestId },
    select: { id: true, eventId: true },
  });
  if (!request) throw new PrintRequestError("NOT_FOUND", 404);

  const body = cleanBody(input.body);
  if (body.length > MAX_BODY_LENGTH) throw new PrintRequestError("VALIDATION", 400);
  if (body.length === 0 && !input.attachmentKey) throw new PrintRequestError("VALIDATION", 400);

  if (input.attachmentKey) {
    const prefix =
      input.side === "STAFF" ? "print-requests/staff/" : `print-requests/${request.eventId}/`;
    if (!input.attachmentKey.startsWith(prefix)) {
      throw new PrintRequestError("INVALID_ATTACHMENT", 400);
    }
  }

  return prisma.printRequestMessage.create({
    data: {
      requestId: request.id,
      authorId: input.authorId,
      side: input.side,
      kind: "MESSAGE",
      body,
      attachmentKey: input.attachmentKey,
    },
  });
}

export type ThreadEntryDTO = {
  id: string;
  side: PrintThreadSide;
  kind: PrintMessageKind;
  body: string;
  eventType: string | null;
  details: unknown;
  attachmentKey: string | null;
  authorName: string | null;
  createdAt: string;
};

export async function listThread(requestId: string): Promise<ThreadEntryDTO[]> {
  const rows = await prisma.printRequestMessage.findMany({
    where: { requestId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { author: { select: { name: true } } },
  });
  return rows.map((m) => ({
    id: m.id,
    side: m.side,
    kind: m.kind,
    body: m.body,
    eventType: m.eventType,
    details: m.details,
    attachmentKey: m.attachmentKey,
    authorName: m.author?.name ?? null,
    createdAt: m.createdAt.toISOString(),
  }));
}
