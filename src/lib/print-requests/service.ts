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

// Collision sur la colonne `reference` seulement : MySQL donne le nom de l'index
// (« PrintRequest_reference_key »), d'autres pilotes un tableau de colonnes. Toute autre
// contrainte unique (ex. [requestId, kind] du crédit) est une vraie erreur : elle remonte aussitôt.
function isReferenceCollision(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  const target = err.meta?.target;
  const names = Array.isArray(target) ? target.map(String) : [String(target)];
  return names.some((n) => n.includes("reference"));
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
  // Hors des statuts qui retiennent le template, l'épinglage de la demande est levé. Si
  // l'évènement retrouve ainsi l'héritage, les copies de ses demandes en cours (dont celle-ci, si
  // elle reste en cours) sont resynchronisées dans la même transaction : l'appelant tient déjà les
  // verrous Event puis PrintRequest (lockRequestWithEvent), aucune autre transaction n'est ouverte.
  if (!PIN_HOLDING_STATUSES.includes(to) && (await releaseTemplatePin(tx, request.id))) {
    await resyncEventRequests(tx, request.id);
  }
  return to;
}

export const SYNCED_STATUSES: PrintRequestStatus[] = ["SUBMITTED", "QUOTED", "ACCEPTED"];

// Aligne la copie du template d'UNE demande sur le template effectif de son évènement. Le
// verrou de la demande (lockRequestWithEvent) doit être tenu. Les brouillons et les demandes
// payées ne sont pas touchés ; une demande ACCEPTED avec paiement en cours est laissée telle
// quelle. Vrai si la demande a été repassée en SUBMITTED (entrée TEMPLATE_CHANGED au fil).
export async function syncLockedRequest(tx: Prisma.TransactionClient, requestId: string): Promise<boolean> {
  const request = await tx.printRequest.findUnique({ where: { id: requestId } });
  if (!request || !SYNCED_STATUSES.includes(request.status)) return false;
  const target = await snapshotEventTemplate(request.eventId, tx);
  if (request.badgeTemplateId === target.badgeTemplateId) return false;
  if (request.status === "ACCEPTED" && (await isPaymentInProgress(requestId))) return false;
  const previous = request.badgeTemplateId
    ? await tx.installedBadgeTemplate.findUnique({
        where: { id: request.badgeTemplateId },
        select: { label: true },
      })
    : null;
  const acceptanceCancelled = request.status === "ACCEPTED";
  await applyTransition(tx, request, "TEMPLATE_CHANGED", "SYSTEM");
  await tx.printRequest.update({
    where: { id: requestId },
    data: {
      badgeTemplateId: target.badgeTemplateId,
      badgeWidthPx: target.badgeWidthPx,
      badgeHeightPx: target.badgeHeightPx,
      badgePages: target.badgePages,
    },
  });
  await appendThreadEvent(tx, requestId, "TEMPLATE_CHANGED", {
    fromLabel: previous?.label ?? "—",
    toLabel: target.label,
    acceptanceCancelled,
  });
  return true;
}

// Après la remise d'un évènement à l'héritage : resynchronise ses demandes en cours (l'évènement
// et la demande `heldRequestId` sont déjà verrouillés ; les autres le sont ici, Event d'abord).
async function resyncEventRequests(tx: Prisma.TransactionClient, heldRequestId: string): Promise<void> {
  const { event } = await tx.printRequest.findUniqueOrThrow({
    where: { id: heldRequestId },
    select: { event: { select: { id: true, orgId: true, badgeTemplateId: true } } },
  });
  // Aucun template effectif (ni évènement, ni organisation, ni plateforme) : rien sur quoi aligner
  // les copies, et ce n'est pas à la libération du verrou d'échouer.
  if (!(await findEffectiveTemplateRow(await resolveEventTemplateId(event)))) return;
  const siblings = await tx.printRequest.findMany({
    where: { eventId: event.id, status: { in: SYNCED_STATUSES } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  for (const { id } of siblings) {
    await lockRequestWithEvent(tx, id);
    await syncLockedRequest(tx, id);
  }
}

// Une demande complémentaire (surplus facturé à la clôture) est une quantité ferme fixée par le
// poste : l'organisateur ne la modifie ni ne l'annule, il l'accepte ou la laisse au staff.
export function assertOrganizerMayChange(
  request: { parentRequestId?: string | null },
  side: "ORGANIZER" | "STAFF",
): void {
  if (side === "ORGANIZER" && request.parentRequestId) throw new PrintRequestError("REQUEST_LOCKED", 409);
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
  request: Pick<PrintRequest, "id" | "status"> & { parentRequestId?: string | null },
  side: "ORGANIZER" | "STAFF",
  userId: string,
): Promise<{ from: PrintRequestStatus; to: PrintRequestStatus }> {
  assertOrganizerMayChange(request, side);
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
  opts: { paymentId?: string; manual?: { userId: string; reason: string }; byCredit?: boolean },
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
      // Devis entièrement couvert par le crédit d'impression : aucun paiement n'a eu lieu.
      ...(opts.byCredit ? { byCredit: true } : {}),
    },
    manual ? { userId: manual.userId, side: "STAFF" } : undefined,
  );
  return true;
}
