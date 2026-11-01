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
  const label = txt(c.label);
  if (c.op === "ADDED") {
    const to = qp(c.to);
    return `Ligne ajoutée : ${label} (${to.quantity} × ${formatFcfa(to.unitPrice)})`;
  }
  if (c.op === "REMOVED") return `Ligne retirée : ${label}`;
  const from = qp(c.from);
  const to = qp(c.to);
  const parts: string[] = [];
  if (from.quantity !== to.quantity) parts.push(`quantité ${from.quantity} → ${to.quantity}`);
  if (from.unitPrice !== to.unitPrice) {
    parts.push(`prix unitaire ${formatFcfa(from.unitPrice)} → ${formatFcfa(to.unitPrice)}`);
  }
  // Changement d'intitulé seul : aucune différence de quantité ni de prix à détailler.
  return parts.length > 0 ? `Ligne modifiée : ${label} (${parts.join(", ")})` : `Ligne modifiée : ${label}`;
}

// Valeurs par défaut sûres : un `details` mal formé ne produit ni « NaN FCFA » ni « undefined ».
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const txt = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v) : "—");
const qp = (v?: { quantity: number; unitPrice: number }) => ({
  quantity: num(v?.quantity),
  unitPrice: num(v?.unitPrice),
});
const F = (x: unknown) => formatFcfa(num(x));
const L = (s: unknown) => PRINT_REQUEST_STATUS_LABELS[s as PrintRequestStatus] ?? txt(s);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const changesOf = (v: unknown): LineChange[] => (Array.isArray(v) ? (v as LineChange[]) : []);

export function describeThreadEvent(
  eventType: ThreadEventType,
  details: Record<string, unknown>,
): string {
  switch (eventType) {
    case "LINES_CHANGED": {
      const changes = changesOf(details.changes);
      return changes.length === 1
        ? describeLineChange(changes[0])
        : `${changes.length} lignes modifiées`;
    }
    case "SUBMITTED":
      return `Demande envoyée : ${num(details.badgeCount)} badges, total estimé ${F(details.total)}`;
    case "BADGES_CHANGED": {
      const lagging = strings(details.lagging);
      const base = `Badges de la demande : +${num(details.added)}, −${num(details.removed)} (${num(details.count)} au total)`;
      return lagging.length > 0
        ? `${base} — quantités fixées par l'équipe à vérifier : ${lagging.join(", ")}`
        : base;
    }
    case "REQUEST_UPDATED": {
      const lagging = strings(details.lagging);
      const base = `Informations modifiées : ${strings(details.fields).join(", ")}`;
      return lagging.length > 0
        ? `${base} — quantités fixées par l'équipe à vérifier : ${lagging.join(", ")}`
        : base;
    }
    case "QUOTE_SENT":
      return `Devis v${num(details.version)} envoyé : ${F(details.total)}`;
    case "QUOTE_ACCEPTED":
      return `Devis v${num(details.version)} accepté : ${F(details.total)}`;
    case "QUOTE_REOPENED":
      return `Devis v${num(details.version)} rouvert : l'acceptation est annulée`;
    case "QUOTE_REVISION":
      return "Devis en révision : il sera renvoyé avant acceptation";
    case "TEMPLATE_CHANGED":
      return (
        `Template de badge changé : ${txt(details.fromLabel)} → ${txt(details.toLabel)}` +
        (details.acceptanceCancelled ? "; l'acceptation est annulée" : "")
      );
    case "STATUS_CHANGED":
      return `Statut : ${L(details.from)} → ${L(details.to)}`;
    case "REJECTED":
      return `Demande refusée : ${txt(details.reason)}`;
    case "CANCELLED":
      return "Demande annulée";
    case "PAYMENT_RECEIVED":
      return (
        `Paiement reçu : ${F(details.amount)}` +
        (typeof details.reason === "string" && details.reason ? ` (hors ligne : ${details.reason})` : "")
      );
    case "PAYMENT_FAILED":
      return `Paiement échoué : ${F(details.amount)}`;
    case "PAYMENT_UNMATCHED":
      return `Paiement reçu sans correspondance avec le devis : ${F(details.amount)}`;
    case "SHEETS_GENERATED":
      return `Planches lancées pour ${num(details.badgeCount)} badges`;
    case "REGISTRATIONS_SKIPPED": {
      const ids = strings(details.registrationIds);
      return `${ids.length} badge(s) écarté(s) à la génération (inscription non approuvée) : ${ids.join(", ")}`;
    }
  }
}

// Ajoute une entrée automatique au fil ; les modifications de lignes consécutives du même
// auteur sont regroupées dans la dernière entrée. Les ajouts sont sérialisés par demande :
// la ligne PrintRequest est verrouillée (FOR UPDATE) avant de lire la dernière entrée, donc
// deux modifications concurrentes ne perdent aucun changement. Les corps (messages et textes
// d'évènement) sont stockés bruts et doivent être rendus en texte, jamais en HTML.
export async function appendThreadEvent(
  tx: Prisma.TransactionClient,
  requestId: string,
  eventType: ThreadEventType,
  details: Record<string, unknown>,
  actor: ThreadActor = SYSTEM_ACTOR,
): Promise<PrintRequestMessage> {
  await tx.$queryRaw`SELECT id FROM \`PrintRequest\` WHERE id = ${requestId} FOR UPDATE`;
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
      const previous = changesOf((last.details as { changes?: unknown } | null)?.changes);
      const merged = { ...details, changes: [...previous, ...changesOf(details.changes)] };
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
    // Forme stricte : préfixe + un seul nom de fichier (pas de sous-dossier, pas de « .. »).
    const prefix =
      input.side === "STAFF" ? "print-requests/staff/" : `print-requests/${request.eventId}/`;
    const name = input.attachmentKey.slice(prefix.length);
    if (
      input.attachmentKey.length > 300 ||
      !input.attachmentKey.startsWith(prefix) ||
      !/^[A-Za-z0-9._-]+$/.test(name) ||
      name === "." ||
      name === ".."
    ) {
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

// Les `body` (messages et textes d'évènement) sont stockés bruts : à rendre en texte, jamais en HTML.
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
