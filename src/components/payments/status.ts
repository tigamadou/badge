import type { PaymentPurpose, PaymentStatus, SubscriptionChangeMode } from "@prisma/client";

// Libellés français partagés par le module Paiements, l'historique et le reçu.
export const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Payé",
  DECLINED: "Refusé",
  CANCELED: "Annulé",
  EXPIRED: "Expiré",
};

export const PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  SUBSCRIPTION: "Abonnement",
  PRINT_REQUEST: "Impression",
};

export const MODE_LABELS: Record<SubscriptionChangeMode, string> = {
  IMMEDIATE: "Changement immédiat",
  EXTENSION: "Renouvellement",
  SCHEDULED: "Changement programmé",
};

const amountFormat = new Intl.NumberFormat("fr-FR");

export function fcfa(amount: number): string {
  return `${amountFormat.format(amount)} FCFA`;
}

// Dates en UTC : même rendu côté serveur et dans le reçu, quel que soit le fuseau du serveur.
export function fmtDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}
