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
    select: { orgId: true, plan: { select: { name: true } } },
  });
  if (!payment || payment.orgId !== orgId) return NOT_FOUND;
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
