import type { PrintRequestStatus, PrintRequestType } from "@prisma/client";

export type StepState = "done" | "current" | "todo" | "stopped";
export interface OrderStep {
  key: PrintRequestStatus;
  label: string;
  state: StepState;
}

// Frise commune aux commandes ADVANCE et ONSITE.
const STEPS: { key: PrintRequestStatus; label: string }[] = [
  { key: "SUBMITTED", label: "Envoyée" },
  { key: "QUOTED", label: "Devis" },
  { key: "ACCEPTED", label: "Accepté" },
  { key: "PAID", label: "Payée" },
  { key: "IN_PRODUCTION", label: "Production" },
  { key: "READY", label: "Prête" },
  { key: "COMPLETED", label: "Terminée" },
];

// `stoppedAt` : étape où une commande refusée ou annulée s'est arrêtée (la commande ne la porte
// pas elle-même) ; par défaut la première.
export function orderSteps(
  status: PrintRequestStatus,
  _type: PrintRequestType,
  stoppedAt: PrintRequestStatus = "SUBMITTED",
): OrderStep[] {
  if (status === "REJECTED" || status === "CANCELLED") {
    const stop = Math.max(0, STEPS.findIndex((s) => s.key === stoppedAt));
    return STEPS.slice(0, stop + 1).map((s, i) => ({ ...s, state: i === stop ? "stopped" : "done" }));
  }
  const current = STEPS.findIndex((s) => s.key === status);
  return STEPS.map((s, i) => ({
    ...s,
    state: current === -1 ? "todo" : i < current ? "done" : i === current ? "current" : "todo",
  }));
}
