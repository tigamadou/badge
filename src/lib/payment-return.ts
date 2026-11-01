import { prisma } from "@/lib/prisma";
import { confirmPayment } from "@/lib/payments";

export type PaymentReturn = {
  outcome: "APPROVED" | "SCHEDULED" | "PENDING" | "FAILED" | "NOT_FOUND";
  planName: string;
  activationDate: Date | null;
};

const NOT_FOUND: PaymentReturn = { outcome: "NOT_FOUND", planName: "", activationDate: null };

// Page de retour FedaPay : l'URL n'est jamais crue. Le paiement doit appartenir à
// l'organisation avant tout appel à FedaPay, puis seul l'état confirmé fait foi.
export async function resolvePaymentReturn(
  orgId: string,
  rawId: string | undefined,
): Promise<PaymentReturn> {
  const transactionId = Number(rawId);
  if (!rawId || !Number.isInteger(transactionId)) return NOT_FOUND;

  const payment = await prisma.payment.findUnique({
    where: { fedapayTransactionId: transactionId },
    select: { orgId: true, purpose: true, plan: { select: { name: true } } },
  });
  if (!payment || payment.orgId !== orgId) return NOT_FOUND;
  // La page abonnement ne confirme jamais un paiement d'impression.
  if (payment.purpose !== "SUBSCRIPTION" || !payment.plan) return NOT_FOUND;
  const planName = payment.plan.name;

  let status;
  try {
    const result = await confirmPayment(transactionId);
    if (!result) return NOT_FOUND;
    status = result.status;
  } catch (error) {
    console.error("[return fedapay]", error);
    return { outcome: "PENDING", planName, activationDate: null };
  }

  // EXPIRED : balayé après 24 h mais pas refusé par FedaPay, donc encore indéterminé pour l'utilisateur.
  if (status === "PENDING" || status === "EXPIRED") return { outcome: "PENDING", planName, activationDate: null };
  if (status !== "APPROVED") return { outcome: "FAILED", planName, activationDate: null };

  // Le mode n'est connu qu'une fois le paiement appliqué : relecture après confirmation.
  const applied = await prisma.payment.findUniqueOrThrow({
    where: { fedapayTransactionId: transactionId },
    select: { mode: true, org: { select: { subscription: { select: { endDate: true } } } } },
  });
  if (applied.mode === "SCHEDULED") {
    return {
      outcome: "SCHEDULED",
      planName,
      activationDate: applied.org.subscription?.endDate ?? null,
    };
  }
  return { outcome: "APPROVED", planName, activationDate: null };
}

export type PrintPaymentReturn = {
  outcome: "PAID" | "UNMATCHED" | "PENDING" | "FAILED" | "NOT_FOUND";
  reference: string;
  amount: number;
};

const PRINT_NOT_FOUND: PrintPaymentReturn = { outcome: "NOT_FOUND", reference: "", amount: 0 };

// Retour FedaPay d'un devis d'impression : même méthode que l'abonnement. Le paiement doit
// appartenir à la demande avant tout appel à FedaPay, puis seul l'état confirmé fait foi.
export async function resolvePrintPaymentReturn(
  requestId: string,
  rawId: string | undefined,
): Promise<PrintPaymentReturn> {
  const transactionId = Number(rawId);
  if (!rawId || !Number.isInteger(transactionId)) return PRINT_NOT_FOUND;

  const payment = await prisma.payment.findFirst({
    where: { fedapayTransactionId: transactionId, purpose: "PRINT_REQUEST", printRequestId: requestId },
    select: { id: true, amount: true },
  });
  if (!payment) return PRINT_NOT_FOUND;
  const { reference } = await prisma.printRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { reference: true },
  });
  const base = { reference, amount: payment.amount };

  let status;
  try {
    const result = await confirmPayment(transactionId);
    if (!result) return PRINT_NOT_FOUND;
    status = result.status;
  } catch (error) {
    console.error("[return fedapay]", error);
    return { outcome: "PENDING", ...base };
  }

  if (status === "PENDING" || status === "EXPIRED") return { outcome: "PENDING", ...base };
  if (status !== "APPROVED") return { outcome: "FAILED", ...base };

  // Relecture après confirmation : seul le paiement qui a soldé la demande (paidPaymentId, posé
  // par markPaid) donne PAID, même si la demande a avancé depuis. Sinon l'équipe Badge tranche.
  const request = await prisma.printRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { paidPaymentId: true },
  });
  return { outcome: request.paidPaymentId === payment.id ? "PAID" : "UNMATCHED", ...base };
}
