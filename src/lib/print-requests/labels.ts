import type { PrintRequestStatus, PrintRequestType } from "@prisma/client";

// Réexports : formatFcfa (plan 32) et chunk (badge-batch) ne sont pas dupliqués.
export { formatFcfa } from "@/lib/print-catalog/pricing-core";
export { chunk } from "@/lib/badge-batch";

export const PRINT_REQUEST_STATUS_LABELS: Record<PrintRequestStatus, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Envoyée",
  QUOTED: "Devis envoyé",
  ACCEPTED: "Devis accepté",
  PAID: "Payée",
  IN_PRODUCTION: "En production",
  READY: "Prête",
  COMPLETED: "Terminée",
  REJECTED: "Refusée",
  CANCELLED: "Annulée",
};

export const PRINT_REQUEST_TYPE_LABELS: Record<PrintRequestType, string> = {
  ADVANCE: "En amont",
  ONSITE: "Pendant l'évènement",
};

// Statuts qui réservent du stock : tous sauf brouillon, refusée et annulée.
export const RESERVING_STATUSES: PrintRequestStatus[] = [
  "SUBMITTED",
  "QUOTED",
  "ACCEPTED",
  "PAID",
  "IN_PRODUCTION",
  "READY",
  "COMPLETED",
];
