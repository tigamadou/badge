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
import { describeLineChange, num, txt, type LineChange } from "./line-change";

// Pur et réutilisable côté navigateur : défini dans line-change.ts.
export { describeLineChange, type LineChange };

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
  | "REGISTRATIONS_SKIPPED"
  | "ORG_CREDIT_APPLIED"
  | "ORG_CREDIT_SPENT"
  | "ONSITE_MARGIN_CHANGED"
  | "ONSITE_CREDIT_EARNED"
  | "ONSITE_SUPPLEMENT_CREATED";

export type ThreadActor = { userId: string | null; side: PrintThreadSide };

const SYSTEM_ACTOR: ThreadActor = { userId: null, side: "SYSTEM" };

const MAX_BODY_LENGTH = 5000;

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
      return `Commande envoyée : ${num(details.badgeCount)} badges, total estimé ${F(details.total)}`;
    case "BADGES_CHANGED": {
      const lagging = strings(details.lagging);
      const base = `Badges de la commande : +${num(details.added)}, −${num(details.removed)} (${num(details.count)} au total)`;
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
      return `Commande refusée : ${txt(details.reason)}`;
    case "CANCELLED":
      return "Commande annulée";
    case "PAYMENT_RECEIVED":
      if (details.byCredit === true) return "Devis réglé par le crédit d'impression : aucun paiement à effectuer";
      return (
        `Paiement reçu : ${F(details.amount)}` +
        (typeof details.reason === "string" && details.reason ? ` (hors ligne : ${details.reason})` : "")
      );
    case "PAYMENT_FAILED":
      return `Paiement échoué : ${F(details.amount)}`;
    case "PAYMENT_UNMATCHED":
      return `Paiement de ${F(details.amount)} reçu alors que la commande n'attendait plus ce paiement : l'équipe Badge vérifie.`;
    case "SHEETS_GENERATED":
      return `Planches lancées pour ${num(details.badgeCount)} badges`;
    case "REGISTRATIONS_SKIPPED": {
      const ids = strings(details.registrationIds);
      return `${ids.length} badge(s) écarté(s) à la génération (inscription non approuvée) : ${ids.join(", ")}`;
    }
    case "ORG_CREDIT_APPLIED":
      return `Crédit d'impression appliqué : ${F(details.amount)}`;
    case "ORG_CREDIT_SPENT":
      return `Crédit d'impression décompté : ${F(details.amount)}`;
    case "ONSITE_MARGIN_CHANGED":
      // Sans motif (côté organisateur, il reste interne au staff) : pas de parenthèses.
      return `Marge : ${num(details.from)} % → ${num(details.to)} %${details.reason ? ` (${txt(details.reason)})` : ""}`;
    case "ONSITE_CREDIT_EARNED":
      return `${num(details.quantity)} badges non utilisés : ${F(details.amount)} versés au crédit d'impression`;
    case "ONSITE_SUPPLEMENT_CREATED":
      return `Commande complémentaire ${txt(details.reference)} : ${num(details.extraBadges)} badges supplémentaires`;
  }
}

// Ajoute une entrée automatique au fil ; les modifications de lignes consécutives du même
// auteur sont regroupées dans la dernière entrée. Les ajouts sont sérialisés par commande :
// la ligne PrintRequest est verrouillée (FOR UPDATE) avant de lire la dernière entrée, donc
// deux modifications concurrentes ne perdent aucun changement. Les corps (messages et textes
// d'évènement) sont stockés bruts et doivent être rendus en texte, jamais en HTML.
export async function appendThreadEvent(
  tx: Prisma.TransactionClient,
  requestId: string,
  eventType: ThreadEventType,
  details: Record<string, unknown>,
  actor: ThreadActor = SYSTEM_ACTOR,
  opts: { internal?: boolean } = {},
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
      last.authorId === actor.userId &&
      last.internal === (opts.internal ?? false)
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
      internal: opts.internal ?? false,
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
  internal?: boolean;
}): Promise<PrintRequestMessage> {
  // Une note interne n'existe que côté staff.
  if (input.internal && input.side !== "STAFF") throw new PrintRequestError("VALIDATION", 400);
  const request = await prisma.printRequest.findUnique({
    where: { id: input.requestId },
    select: { id: true, eventId: true, status: true },
  });
  if (!request) throw new PrintRequestError("NOT_FOUND", 404);
  // Un brouillon n'a jamais été vu du staff : pas d'échange (et donc aucune notification).
  if (request.status === "DRAFT") {
    throw new PrintRequestError("INVALID_TRANSITION", 409, { from: request.status, action: "MESSAGE" });
  }

  const body = cleanBody(input.body);
  if (body.length > MAX_BODY_LENGTH) throw new PrintRequestError("VALIDATION", 400);
  if (body.length === 0 && !input.attachmentKey) throw new PrintRequestError("VALIDATION", 400);

  if (input.attachmentKey) {
    // Forme stricte : préfixe + un seul nom de fichier (pas de sous-dossier, pas de « .. »).
    // Le préfixe lie la pièce à la commande (staff) ou à l'évènement (organisateur) : une clé d'une
    // autre commande ou d'une autre organisation est refusée, et /api/files en déduit l'évènement.
    const prefix =
      input.side === "STAFF" ? `print-requests/staff/${request.id}/` : `print-requests/${request.eventId}/`;
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
      internal: input.internal ?? false,
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
  internal: boolean;
  authorName: string | null;
  createdAt: string;
};

// Détails visibles de l'organisateur, par type d'entrée (liste blanche) : tout ce qui est interne
// (identifiants de paiement ou de génération, motif d'un passage manuel en payée…) est retiré.
// Les clés listées suffisent à rédiger le texte de l'entrée (describeThreadEvent).
const ORGANIZER_DETAILS: Record<ThreadEventType, string[]> = {
  SUBMITTED: ["badgeCount", "total"],
  LINES_CHANGED: ["changes"],
  BADGES_CHANGED: ["added", "removed", "count", "lagging"],
  REQUEST_UPDATED: ["fields", "lagging"],
  QUOTE_SENT: ["version", "total"],
  QUOTE_ACCEPTED: ["version", "total"],
  QUOTE_REOPENED: ["version"],
  QUOTE_REVISION: [],
  TEMPLATE_CHANGED: ["fromLabel", "toLabel", "acceptanceCancelled"],
  STATUS_CHANGED: ["from", "to"],
  REJECTED: ["reason"],
  CANCELLED: [],
  PAYMENT_RECEIVED: ["amount", "byCredit"],
  PAYMENT_FAILED: ["amount"],
  PAYMENT_UNMATCHED: ["amount"],
  SHEETS_GENERATED: ["badgeCount"],
  REGISTRATIONS_SKIPPED: ["registrationIds"],
  ORG_CREDIT_APPLIED: ["amount"],
  ORG_CREDIT_SPENT: ["amount"],
  // Le motif d'un changement de marge reste interne au staff.
  ONSITE_MARGIN_CHANGED: ["from", "to"],
  ONSITE_CREDIT_EARNED: ["quantity", "amount"],
  ONSITE_SUPPLEMENT_CREATED: ["reference", "extraBadges"],
};

// Une ligne modifiée sans son identifiant interne.
function publicChange(change: LineChange): Omit<LineChange, "lineId"> {
  return { op: change.op, label: change.label, from: change.from, to: change.to };
}

function organizerDetails(eventType: ThreadEventType, raw: unknown): Record<string, unknown> {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const details: Record<string, unknown> = {};
  for (const key of ORGANIZER_DETAILS[eventType]) {
    if (source[key] !== undefined) details[key] = source[key];
  }
  if (eventType === "LINES_CHANGED") details.changes = changesOf(details.changes).map(publicChange);
  return details;
}

export type ThreadAudience = "ORGANIZER" | "STAFF";

// Pour l'organisateur, une entrée automatique n'expose que les détails de sa liste blanche et son
// texte est reconstruit à partir d'eux (le texte stocké peut citer une donnée interne).
// Un type d'entrée inconnu perd tous ses détails.
export function toEntryDTO(
  m: PrintRequestMessage,
  authorName: string | null,
  audience: ThreadAudience,
): ThreadEntryDTO {
  let { body, details } = m;
  if (audience === "ORGANIZER" && m.kind === "EVENT") {
    const eventType = m.eventType as ThreadEventType;
    if (Object.hasOwn(ORGANIZER_DETAILS, eventType)) {
      details = organizerDetails(eventType, m.details) as Prisma.JsonValue;
      body = describeThreadEvent(eventType, details as Record<string, unknown>);
    } else {
      details = null;
    }
  }
  return {
    id: m.id,
    side: m.side,
    kind: m.kind,
    body,
    eventType: m.eventType,
    details,
    attachmentKey: m.attachmentKey,
    internal: m.internal,
    authorName,
    createdAt: m.createdAt.toISOString(),
  };
}

export async function listThread(
  requestId: string,
  audience: ThreadAudience,
  opts: { after?: Date } = {},
): Promise<ThreadEntryDTO[]> {
  const rows = await prisma.printRequestMessage.findMany({
    where: {
      requestId,
      ...(audience === "ORGANIZER" ? { internal: false } : {}),
      ...(opts.after ? { createdAt: { gt: opts.after } } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { author: { select: { name: true } } },
  });
  return rows.map((m) => toEntryDTO(m, m.author?.name ?? null, audience));
}
