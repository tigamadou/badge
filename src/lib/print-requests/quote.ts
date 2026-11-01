import { Prisma } from "@prisma/client";
import type { PrintQuoteLine, PrintRequest, PrintRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import {
  loadProductForPricing,
  snapshotChoices,
  validateChoices,
  type OptionChoice,
} from "@/lib/print-catalog/pricing";
import { PrintRequestError } from "./errors";
import {
  choiceFailureToError,
  isEventFileKey,
  MAX_AMOUNT,
  normalizeChoices,
} from "./content";
import {
  appendThreadEvent,
  applyEdit,
  applyTransition,
  assertEditable,
  isPaymentInProgress,
  loadRequest,
  markPaid,
  recomputeTotal,
} from "./service";
import type { LineChange } from "./thread";
import {
  staffLineSchema,
  staffLinePatchSchema,
  type StaffLineInput,
  type StaffLinePatch,
} from "./inputs";
import type { PrintRequestAction } from "./transitions";

const STAFF = { side: "STAFF" } as const;

// Verrouille la ligne de la demande (sérialise les écritures et la sonde de paiement) puis la
// relit. Ordre des verrous du chantier : Event d'abord, PrintRequest ensuite ; le staff ne
// touche jamais aux réservations, il ne prend donc que celui-ci.
async function lockRequest(tx: Prisma.TransactionClient, requestId: string): Promise<PrintRequest> {
  await tx.$queryRaw`SELECT id FROM \`PrintRequest\` WHERE id = ${requestId} FOR UPDATE`;
  const request = await tx.printRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new PrintRequestError("NOT_FOUND", 404);
  return request;
}

// Retire les caractères de contrôle et les espaces de bord, puis borne la longueur.
function cleanReason(raw: string, min: number, max: number): string {
  const reason = raw.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (reason.length < min || reason.length > max) throw new PrintRequestError("VALIDATION", 400);
  return reason;
}

// Montant d'une ligne (colonnes Int de MySQL) : refus propre plutôt qu'une erreur 500.
function assertLineAmount(unitPrice: number, quantity: number): void {
  if (Math.abs(unitPrice * quantity) > MAX_AMOUNT) throw new PrintRequestError("VALIDATION", 400);
}

// Recalcule le total et refuse un total hors bornes (la transaction est alors annulée).
async function recomputeChecked(tx: Prisma.TransactionClient, requestId: string): Promise<number> {
  const sum = await tx.printQuoteLine.aggregate({
    where: { requestId, removedAt: null },
    _sum: { lineTotal: true },
  });
  if (Math.abs(sum._sum.lineTotal ?? 0) > MAX_AMOUNT) throw new PrintRequestError("VALIDATION", 400);
  return recomputeTotal(tx, requestId);
}

function lineDetail(line: Pick<PrintQuoteLine, "quantity" | "unitPrice">) {
  return { quantity: line.quantity, unitPrice: line.unitPrice };
}

export async function addStaffLine(input: {
  requestId: string;
  userId: string;
  line: StaffLineInput;
}): Promise<{ line: PrintQuoteLine; revised: boolean }> {
  const parsed = staffLineSchema.safeParse(input.line);
  if (!parsed.success) throw new PrintRequestError("VALIDATION", 400);
  const line = parsed.data;
  const request = await loadRequest(input.requestId);
  assertLineAmount(line.unitPrice, line.quantity);

  let productId: string | null = null;
  let choices: OptionChoice[] | null = null;
  let snapshot: Prisma.InputJsonValue | null = null;
  if (line.kind === "PRODUCT") {
    const product = await loadProductForPricing(line.productId!);
    if (!product || product.archived || !product.published) {
      throw new PrintRequestError("PRODUCT_UNAVAILABLE", 400, { productId: line.productId });
    }
    productId = product.id;
    if (line.choices) {
      for (const choice of line.choices) {
        if (choice.fileKey !== undefined && !isEventFileKey(choice.fileKey, request.eventId)) {
          throw new PrintRequestError("INVALID_CHOICES", 400, {
            productId: product.id,
            code: "INVALID_FILE",
            optionId: choice.optionId,
          });
        }
      }
      choices = normalizeChoices(product, line.choices);
      const result = validateChoices(product, choices, line.quantity);
      if (!result.ok) throw choiceFailureToError(product, result);
      // Le prix saisi par le staff fait foi : seul l'instantané des choix vient du catalogue.
      snapshot = snapshotChoices(product, choices, line.quantity) as unknown as Prisma.InputJsonValue;
    }
  }

  return prisma.$transaction(async (tx) => {
    const current = await lockRequest(tx, request.id);
    const { from } = await applyEdit(tx, current, "STAFF", input.userId);
    const last = await tx.printQuoteLine.aggregate({
      where: { requestId: request.id },
      _max: { position: true },
    });
    const created = await tx.printQuoteLine.create({
      data: {
        requestId: request.id,
        kind: line.kind,
        productId,
        label: line.label,
        optionsSnapshot: snapshot ?? Prisma.JsonNull,
        choices: choices ? (choices as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.unitPrice * line.quantity,
        position: (last._max.position ?? -1) + 1,
        addedBy: "STAFF",
      },
    });
    const change: LineChange = { op: "ADDED", lineId: created.id, label: created.label, to: lineDetail(created) };
    await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [change] }, { userId: input.userId, ...STAFF });
    await recomputeChecked(tx, request.id);
    return { line: created, revised: from === "QUOTED" };
  });
}

export async function updateStaffLine(input: {
  requestId: string;
  lineId: string;
  userId: string;
  patch: StaffLinePatch;
}): Promise<{ line: PrintQuoteLine; revised: boolean }> {
  const parsed = staffLinePatchSchema.safeParse(input.patch);
  if (!parsed.success) throw new PrintRequestError("VALIDATION", 400);
  const patch = parsed.data;
  const request = await loadRequest(input.requestId);

  return prisma.$transaction(async (tx) => {
    const current = await lockRequest(tx, request.id);
    assertEditable(current.status, "STAFF");
    const line = await tx.printQuoteLine.findFirst({
      where: { id: input.lineId, requestId: request.id, removedAt: null },
    });
    if (!line) throw new PrintRequestError("NOT_FOUND", 404);

    const label = patch.label ?? line.label;
    const quantity = patch.quantity ?? line.quantity;
    const unitPrice = patch.unitPrice ?? line.unitPrice;
    const priceChanged = unitPrice !== line.unitPrice;
    const quantityChanged = quantity !== line.quantity;
    // Une remise est négative ou nulle, toute autre ligne positive ou nulle.
    if (line.kind === "DISCOUNT" ? unitPrice > 0 : unitPrice < 0) {
      throw new PrintRequestError("VALIDATION", 400);
    }
    assertLineAmount(unitPrice, quantity);
    // Aucun changement réel : rien n'est écrit et un devis envoyé n'est pas révisé.
    if (!priceChanged && !quantityChanged && label === line.label) return { line, revised: false };

    const { from } = await applyEdit(tx, current, "STAFF", input.userId);
    const updated = await tx.printQuoteLine.update({
      where: { id: line.id },
      data: {
        label,
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
        priceOverridden: line.priceOverridden || priceChanged,
        quantityOverridden: line.quantityOverridden || quantityChanged,
      },
    });
    const change: LineChange = {
      op: "UPDATED",
      lineId: line.id,
      label,
      from: lineDetail(line),
      to: lineDetail(updated),
    };
    await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [change] }, { userId: input.userId, ...STAFF });
    await recomputeChecked(tx, request.id);
    return { line: updated, revised: from === "QUOTED" };
  });
}

export async function removeStaffLine(input: {
  requestId: string;
  lineId: string;
  userId: string;
}): Promise<{ revised: boolean }> {
  const request = await loadRequest(input.requestId);
  return prisma.$transaction(async (tx) => {
    const current = await lockRequest(tx, request.id);
    assertEditable(current.status, "STAFF");
    const line = await tx.printQuoteLine.findFirst({
      where: { id: input.lineId, requestId: request.id, removedAt: null },
    });
    if (!line) throw new PrintRequestError("NOT_FOUND", 404);

    const { from } = await applyEdit(tx, current, "STAFF", input.userId);
    await tx.printQuoteLine.update({ where: { id: line.id }, data: { removedAt: new Date() } });
    const change: LineChange = { op: "REMOVED", lineId: line.id, label: line.label, from: lineDetail(line) };
    await appendThreadEvent(tx, request.id, "LINES_CHANGED", { changes: [change] }, { userId: input.userId, ...STAFF });
    await recomputeChecked(tx, request.id);
    return { revised: from === "QUOTED" };
  });
}

export async function sendQuote(input: {
  requestId: string;
  userId: string;
  now?: Date;
}): Promise<PrintRequest> {
  const request = await loadRequest(input.requestId);
  return prisma.$transaction(async (tx) => {
    const current = await lockRequest(tx, request.id);
    // Transition d'abord : un statut interdit prime sur un devis vide. Les refus qui suivent
    // annulent la transaction, donc rien n'est écrit.
    await applyTransition(tx, current, "SEND_QUOTE", "STAFF", input.now);
    const active = await tx.printQuoteLine.count({ where: { requestId: request.id, removedAt: null } });
    if (active === 0) throw new PrintRequestError("EMPTY_QUOTE", 400);
    const total = await recomputeChecked(tx, request.id);
    if (total < 0) throw new PrintRequestError("NEGATIVE_TOTAL", 400);
    const version = current.quoteVersion + 1;
    await tx.printRequest.update({ where: { id: request.id }, data: { quoteVersion: version } });
    await appendThreadEvent(tx, request.id, "QUOTE_SENT", { version, total }, { userId: input.userId, ...STAFF });
    return tx.printRequest.findUniqueOrThrow({ where: { id: request.id } });
  });
}

export async function reopenQuote(input: { requestId: string; userId: string }): Promise<PrintRequest> {
  const request = await loadRequest(input.requestId);
  return prisma.$transaction(async (tx) => {
    // Verrou avant la sonde de paiement (applyTransition la consulte pour REOPEN).
    const current = await lockRequest(tx, request.id);
    const version = current.acceptedVersion ?? current.quoteVersion;
    await applyTransition(tx, current, "REOPEN", "STAFF");
    await appendThreadEvent(tx, request.id, "QUOTE_REOPENED", { version }, { userId: input.userId, ...STAFF });
    return tx.printRequest.findUniqueOrThrow({ where: { id: request.id } });
  });
}

export async function rejectRequest(input: {
  requestId: string;
  userId: string;
  reason: string;
}): Promise<PrintRequest> {
  const reason = cleanReason(input.reason, 3, 1000);
  const request = await loadRequest(input.requestId);
  return prisma.$transaction(async (tx) => {
    const current = await lockRequest(tx, request.id);
    await applyTransition(tx, current, "REJECT", "STAFF");
    await appendThreadEvent(tx, request.id, "REJECTED", { reason }, { userId: input.userId, ...STAFF });
    return tx.printRequest.findUniqueOrThrow({ where: { id: request.id } });
  });
}

const ADVANCE_ACTIONS: Record<string, PrintRequestAction> = {
  IN_PRODUCTION: "START_PRODUCTION",
  READY: "MARK_READY",
  COMPLETED: "COMPLETE",
};

export async function advanceStatus(input: {
  requestId: string;
  userId: string;
  to: "IN_PRODUCTION" | "READY" | "COMPLETED";
}): Promise<PrintRequest> {
  const action = Object.hasOwn(ADVANCE_ACTIONS, input.to) ? ADVANCE_ACTIONS[input.to] : null;
  if (!action) throw new PrintRequestError("VALIDATION", 400);
  const request = await loadRequest(input.requestId);
  return prisma.$transaction(async (tx) => {
    const current = await lockRequest(tx, request.id);
    const from: PrintRequestStatus = current.status;
    const to = await applyTransition(tx, current, action, "STAFF");
    await appendThreadEvent(tx, request.id, "STATUS_CHANGED", { from, to }, { userId: input.userId, ...STAFF });
    return tx.printRequest.findUniqueOrThrow({ where: { id: request.id } });
  });
}

// Seul passage manuel en PAID du chantier : STAFF_ADMIN (ou SUPER_ADMIN) avec un motif.
export async function markPaidManually(input: {
  requestId: string;
  userId: string;
  reason: string;
}): Promise<PrintRequest> {
  const ctx = await loadUserContext(input.userId);
  const allowed = ctx?.isStaff && (ctx.staffRole === "STAFF_ADMIN" || ctx.staffRole === "SUPER_ADMIN");
  if (!allowed) throw new PrintRequestError("STAFF_FORBIDDEN", 403);
  const reason = cleanReason(input.reason, 3, 500);
  const request = await loadRequest(input.requestId);

  return prisma.$transaction(async (tx) => {
    // Verrou de la demande avant la sonde : sans lui, un paiement PENDING pourrait apparaître
    // entre la sonde et l'écriture.
    await lockRequest(tx, request.id);
    if (await isPaymentInProgress(request.id)) throw new PrintRequestError("PAYMENT_IN_PROGRESS", 409);
    const done = await markPaid(tx, request.id, { manual: { userId: input.userId, reason } });
    if (!done) throw new PrintRequestError("INVALID_TRANSITION", 409);
    return tx.printRequest.findUniqueOrThrow({ where: { id: request.id } });
  });
}
