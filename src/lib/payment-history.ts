import type { Prisma } from "@prisma/client";
import type { PaymentHistoryItem } from "@/components/admin/PaymentHistory";

// Sélection commune des pages d'abonnement (org et staff) : tous les paiements de l'org.
export const PAYMENT_HISTORY_SELECT = {
  id: true,
  createdAt: true,
  amount: true,
  status: true,
  fedapayReference: true,
  plan: { select: { name: true } },
  printRequest: { select: { reference: true } },
} satisfies Prisma.PaymentSelect;

export function toPaymentHistoryItem(
  row: Prisma.PaymentGetPayload<{ select: typeof PAYMENT_HISTORY_SELECT }>,
): PaymentHistoryItem {
  const { plan, printRequest, ...rest } = row;
  const label = plan?.name ?? (printRequest ? `Impression ${printRequest.reference}` : "—");
  return { ...rest, label };
}
