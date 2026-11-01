import { Prisma } from "@prisma/client";
import type {
  PrintRequest,
  PrintRequestStatus,
  PrintRequestType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import {
  findEffectiveTemplateRow,
  resolveEventTemplateId,
} from "@/lib/badge-templates/event-template-variables";
import { PrintRequestError } from "./errors";
import { nextStatus, type PrintRequestAction, type PrintRequestActor } from "./transitions";
import { appendThreadEvent } from "./thread";
import { releaseTemplatePin } from "./template-lock-core";

export { appendThreadEvent } from "./thread";

// Sonde de paiement en cours : un Payment PENDING de la demande. Objet mutable : les tests la
// remplacent avec vi.spyOn.
export const paymentProbe: { isPaymentInProgress(requestId: string): Promise<boolean> } = {
  isPaymentInProgress: async (requestId) =>
    (await prisma.payment.count({ where: { printRequestId: requestId, status: "PENDING" } })) > 0,
};

// Les appelants doivent tenir le verrou de la ligne de la demande (SELECT ... FOR UPDATE) avant
// de sonder : sinon un paiement PENDING peut apparaître entre la sonde et l'écriture. Cela vaut
// pour les transitions gardées (REOPEN, CANCEL depuis ACCEPTED, MARK_PAID manuel, TEMPLATE_CHANGED).
export function isPaymentInProgress(requestId: string): Promise<boolean> {
  return paymentProbe.isPaymentInProgress(requestId);
}

// Tout appelant qui verrouille une demande passe par ce helper (Event puis PrintRequest) : l'ordre
// est le même que celui des changements de template (verrou de l'évènement d'abord), donc pas
// d'interblocage. L'évènement de la demande est lu hors transaction (il ne change jamais) pour ne
// pas figer l'instantané de lecture avant d'avoir obtenu les verrous.
export async function lockRequestWithEvent(
  tx: Prisma.TransactionClient,
  requestId: string,
): Promise<{ eventId: string }> {
  const request = await prisma.printRequest.findUnique({ where: { id: requestId }, select: { eventId: true } });
  if (!request) throw new PrintRequestError("NOT_FOUND", 404);
  await tx.$queryRaw`SELECT id FROM \`Event\` WHERE id = ${request.eventId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM \`PrintRequest\` WHERE id = ${requestId} FOR UPDATE`;
  return { eventId: request.eventId };
}

// Seul un propriétaire de l'organisation peut accepter un devis (le staff n'agit jamais côté organisateur).
export async function assertOwner(userId: string, orgId: string): Promise<void> {
  const ctx = await loadUserContext(userId);
  if (ctx?.isStaff) throw new PrintRequestError("STAFF_FORBIDDEN", 403);
  const isOwner = ctx?.orgMemberships.some((m) => m.orgId === orgId && m.role === "OWNER") ?? false;
  if (!isOwner) throw new PrintRequestError("OWNER_REQUIRED", 403);
}

const REFERENCE_ATTEMPTS = 3;

// IMP-{année}-{plus grand suffixe de l'année + 1, sur 4 chiffres} : un comptage entrerait en
// collision après la suppression d'un évènement (cascade). La collision résiduelle (écritures
// concurrentes) est rejouée par createDraft.
export async function nextReference(tx: Prisma.TransactionClient, now: Date): Promise<string> {
  const prefix = `IMP-${now.getUTCFullYear()}-`;
  const rows = await tx.printRequest.findMany({
    where: { reference: { startsWith: prefix } },
    select: { reference: true },
  });
  let max = 0;
  for (const { reference } of rows) {
    const n = Number(reference.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function isReferenceCollision(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// Rejoue `run` (qui ouvre sa propre transaction : l'instantané de lecture de MySQL ne verrait pas
// la référence prise entre-temps) tant que la référence entre en collision, 3 essais au plus.
export async function retryOnReferenceCollision<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (!isReferenceCollision(err) || attempt >= REFERENCE_ATTEMPTS) throw err;
    }
  }
}

export async function createDraft(input: {
  eventId: string;
  orgId: string;
  type: PrintRequestType;
  userId: string;
  now?: Date;
}): Promise<PrintRequest> {
  const now = input.now ?? new Date();
  return retryOnReferenceCollision(() =>
    prisma.$transaction(async (tx) => {
      const reference = await nextReference(tx, now);
      return tx.printRequest.create({
        data: {
          reference,
          eventId: input.eventId,
          orgId: input.orgId,
          type: input.type,
          status: "DRAFT",
          createdById: input.userId,
        },
      });
    }),
  );
}

// Copie du template effectif de l'évènement (format et nombre de pages du badge).
export async function snapshotEventTemplate(
  eventId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<{
  badgeTemplateId: string;
  badgeWidthPx: number;
  badgeHeightPx: number;
  badgePages: number;
  label: string;
}> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { badgeTemplateId: true, orgId: true },
  });
  if (!event) throw new PrintRequestError("NOT_FOUND", 404);
  const row = await findEffectiveTemplateRow(await resolveEventTemplateId(event));
  if (!row) throw new PrintRequestError("VALIDATION", 400);
  return {
    badgeTemplateId: row.id,
    badgeWidthPx: row.pageWidthPx,
    badgeHeightPx: row.pageHeightPx,
    badgePages: row.pages,
    label: row.label,
  };
}

export async function loadRequest(
  requestId: string,
  scope?: { eventId: string },
): Promise<PrintRequest> {
  const request = await prisma.printRequest.findUnique({ where: { id: requestId } });
  if (!request || (scope && request.eventId !== scope.eventId)) {
    throw new PrintRequestError("NOT_FOUND", 404);
  }
  return request;
}

// Actions qui n'ont pas lieu pendant qu'un paiement de la demande est en cours.
function needsPaymentGuard(
  from: PrintRequestStatus,
  action: PrintRequestAction,
  actor: PrintRequestActor,
): boolean {
  return (
    action === "REOPEN" ||
    action === "TEMPLATE_CHANGED" ||
    (action === "CANCEL" && from === "ACCEPTED") ||
    (action === "MARK_PAID" && actor === "STAFF")
  );
}

const PIN_HOLDING_STATUSES: PrintRequestStatus[] = ["ACCEPTED", "PAID", "IN_PRODUCTION", "READY"];

// Applique une transition de la table (nextStatus) sous garde de statut. N'écrit pas le fil :
// l'appelant le fait, il connaît les détails.
export async function applyTransition(
  tx: Prisma.TransactionClient,
  request: Pick<PrintRequest, "id" | "status">,
  action: PrintRequestAction,
  actor: PrintRequestActor,
  now: Date = new Date(),
): Promise<PrintRequestStatus> {
  const from = request.status;
  const to = nextStatus(from, action, actor);
  if (!to) throw new PrintRequestError("INVALID_TRANSITION", 409, { from, action });
  if (needsPaymentGuard(from, action, actor) && (await isPaymentInProgress(request.id))) {
    throw new PrintRequestError("PAYMENT_IN_PROGRESS", 409);
  }

  const data: Prisma.PrintRequestUncheckedUpdateManyInput = { status: to };
  if (action === "SUBMIT") data.submittedAt = now;
  if (action === "SEND_QUOTE") data.quotedAt = now;
  if (action === "MARK_PAID") data.paidAt = now;
  if (action === "COMPLETE") data.completedAt = now;
  if (action === "CANCEL") data.cancelledAt = now;
  if (from === "ACCEPTED" && (to === "SUBMITTED" || to === "CANCELLED")) {
    data.acceptedVersion = null;
    data.acceptedTotal = null;
    data.acceptedAt = null;
    data.acceptedById = null;
  }

  const { count } = await tx.printRequest.updateMany({
    where: { id: request.id, status: from },
    data,
  });
  if (count === 0) throw new PrintRequestError("INVALID_TRANSITION", 409, { from, action });
  // Hors des statuts qui retiennent le template, l'épinglage de la demande est levé.
  if (!PIN_HOLDING_STATUSES.includes(to)) await releaseTemplatePin(tx, request.id);
  return to;
}

// Refuse une modification hors des statuts éditables (sans rien écrire).
export function assertEditable(status: PrintRequestStatus, side: "ORGANIZER" | "STAFF"): void {
  if (status === "ACCEPTED") throw new PrintRequestError("QUOTE_ACCEPTED", 409);
  const action: PrintRequestAction = side === "STAFF" ? "STAFF_EDIT" : "ORGANIZER_EDIT";
  if (!nextStatus(status, action, side)) throw new PrintRequestError("REQUEST_LOCKED", 409);
}

// Modification par l'organisateur ou le staff. Depuis QUOTED, le devis repasse en révision :
// l'entrée QUOTE_REVISION est écrite en premier (l'appelant ajoute ensuite la sienne).
export async function applyEdit(
  tx: Prisma.TransactionClient,
  request: Pick<PrintRequest, "id" | "status">,
  side: "ORGANIZER" | "STAFF",
  userId: string,
): Promise<{ from: PrintRequestStatus; to: PrintRequestStatus }> {
  const from = request.status;
  assertEditable(from, side);
  const action: PrintRequestAction = side === "STAFF" ? "STAFF_EDIT" : "ORGANIZER_EDIT";
  if (from === "QUOTED") await appendThreadEvent(tx, request.id, "QUOTE_REVISION", {}, { userId, side });
  const to = await applyTransition(tx, request, action, side);
  return { from, to };
}

export async function recomputeTotal(tx: Prisma.TransactionClient, requestId: string): Promise<number> {
  const sum = await tx.printQuoteLine.aggregate({
    where: { requestId, removedAt: null },
    _sum: { lineTotal: true },
  });
  const total = sum._sum.lineTotal ?? 0;
  await tx.printRequest.update({ where: { id: requestId }, data: { total } });
  return total;
}

export async function requestBadgeCount(
  tx: Prisma.TransactionClient,
  request: Pick<PrintRequest, "id" | "type" | "estimatedQuantity">,
): Promise<number> {
  if (request.type === "ADVANCE") return tx.printRequestItem.count({ where: { requestId: request.id } });
  return request.estimatedQuantity ?? 0;
}

// Marque la demande payée (paiement en ligne ou saisie hors ligne). Faux si elle n'est plus
// ACCEPTED : rien n'est écrit (le plan 34 traite le paiement tardif). Ni journal ni notification :
// l'appelant les fait après la transaction.
export async function markPaid(
  tx: Prisma.TransactionClient,
  requestId: string,
  opts: { paymentId?: string; manual?: { userId: string; reason: string } },
): Promise<boolean> {
  // Verrou de la ligne : deux confirmations simultanées (webhook et page de retour) s'enchaînent.
  // Demande inconnue : faux, comme avant (le helper lève NOT_FOUND).
  try {
    await lockRequestWithEvent(tx, requestId);
  } catch (e) {
    if (e instanceof PrintRequestError && e.code === "NOT_FOUND") return false;
    throw e;
  }
  const request = await tx.printRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, acceptedTotal: true },
  });
  if (!request || request.status !== "ACCEPTED") return false;

  const { manual } = opts;
  await applyTransition(tx, request, "MARK_PAID", manual ? "STAFF" : "SYSTEM");
  await tx.printRequest.update({
    where: { id: requestId },
    data: { paidPaymentId: opts.paymentId ?? null },
  });
  await appendThreadEvent(
    tx,
    requestId,
    "PAYMENT_RECEIVED",
    {
      amount: request.acceptedTotal ?? 0,
      ...(opts.paymentId ? { paymentId: opts.paymentId } : {}),
      ...(manual ? { reason: manual.reason } : {}),
    },
    manual ? { userId: manual.userId, side: "STAFF" } : undefined,
  );
  return true;
}
