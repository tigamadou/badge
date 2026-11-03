import type { Payment, PaymentStatus } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { appendThreadEvent } from "../../../../src/lib/print-requests/thread";
import { markPaid } from "../../../../src/lib/print-requests/service";
import { markPaidManually } from "../../../../src/lib/print-requests/quote";
import { spendOrgCreditForPaidRequest } from "../../../../src/lib/print-requests/org-credit";
import { notifyPrintRequestPaid } from "../../../../src/lib/notifications/triggers";
import type { DemoContext } from "../context";
import { FEDAPAY_ID_END, parkPrintJobs, type PrintState } from "./helpers";
import type { Scenario } from "./scenarios";

export type PaymentRef = { requestId: string; orgId: string; ownerId: string };

const FAILURE_REASON: Partial<Record<PaymentStatus, string>> = { DECLINED: "declined", CANCELED: "canceled" };

/**
 * Paiement de commande FedaPay simule : aucune requete reseau, la ligne `Payment` est ecrite telle que
 * le webhook la laisserait. APPROVED passe la commande en PAID (et depense le credit applique).
 */
export async function simulateFedapay(
  ctx: DemoContext,
  state: PrintState,
  ref: PaymentRef,
  outcome: PaymentStatus,
): Promise<Payment> {
  const request = await prisma.printRequest.findUniqueOrThrow({
    where: { id: ref.requestId },
    select: { acceptedTotal: true, total: true },
  });
  const transactionId = state.fedapaySeq++;
  if (transactionId > FEDAPAY_ID_END) throw new Error("Plage d'identifiants FedaPay de demo epuisee");
  const amount = request.acceptedTotal ?? request.total;
  const data = {
    orgId: ref.orgId,
    purpose: "PRINT_REQUEST" as const,
    printRequestId: ref.requestId,
    planId: null,
    userId: ref.ownerId,
    amount,
    currency: "XOF",
    status: outcome,
    fedapayTransactionId: transactionId,
    fedapayReference: `demo-fedapay-${transactionId}`,
    approvedAt: outcome === "APPROVED" ? new Date() : null,
  };

  if (outcome === "APPROVED") {
    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({ data });
      const done = await markPaid(tx, ref.requestId, { paymentId: created.id });
      if (!done) throw new Error("La commande n'attend pas de paiement (statut different de ACCEPTED)");
      await spendOrgCreditForPaidRequest(tx, ref.requestId);
      return created;
    });
    await notifyPrintRequestPaid(ref.requestId, ref.ownerId);
    await parkPrintJobs(ctx, state);
    return payment;
  }

  const reason = FAILURE_REASON[outcome];
  return prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({ data });
    if (reason) await appendThreadEvent(tx, ref.requestId, "PAYMENT_FAILED", { amount, paymentId: created.id, reason });
    return created;
  });
}

/** Tentatives de paiement qui n'aboutissent pas : la commande reste ACCEPTED. */
export async function attemptPayments(ctx: DemoContext, state: PrintState, ref: PaymentRef, s: Scenario): Promise<void> {
  for (const outcome of s.failedPayments ?? []) await simulateFedapay(ctx, state, ref, outcome);
  if (s.pendingPayment) await simulateFedapay(ctx, state, ref, "PENDING");
}

/** Solde la commande acceptee selon le scenario (en ligne, hors ligne ou deja reglee par le credit). */
export async function settleOrder(ctx: DemoContext, state: PrintState, ref: PaymentRef, s: Scenario): Promise<void> {
  const current = await prisma.printRequest.findUniqueOrThrow({ where: { id: ref.requestId }, select: { status: true } });
  if (current.status !== "ACCEPTED") return; // devis couvert par le credit : deja PAID a l'acceptation
  if (s.pay === "OFFLINE") {
    await markPaidManually({
      requestId: ref.requestId,
      userId: state.staffAdmin.id,
      reason: "Virement reçu — rapprochement manuel",
    });
    await notifyPrintRequestPaid(ref.requestId, state.staffAdmin.id, { manual: true });
    await parkPrintJobs(ctx, state);
  } else {
    await attemptPayments(ctx, state, ref, { ...s, pendingPayment: false });
    await simulateFedapay(ctx, state, ref, "APPROVED");
  }
  await parkPrintJobs(ctx, state);
}
