import type { PrintRequestStatus } from "@prisma/client";

export type PrintRequestActor = "ORGANIZER" | "STAFF" | "SYSTEM";

export type PrintRequestAction =
  | "SUBMIT"
  | "ORGANIZER_EDIT"
  | "STAFF_EDIT"
  | "SEND_QUOTE"
  | "ACCEPT"
  | "REOPEN"
  | "REJECT"
  | "CANCEL"
  | "MARK_PAID"
  | "START_PRODUCTION"
  | "MARK_READY"
  | "COMPLETE"
  | "TEMPLATE_CHANGED";

type Rule = {
  from: PrintRequestStatus[];
  actors: PrintRequestActor[];
  to: PrintRequestStatus;
};

// Table des transitions (plan 33) : toute combinaison absente est refusée.
const RULES: Record<PrintRequestAction, Rule[]> = {
  SUBMIT: [{ from: ["DRAFT"], actors: ["ORGANIZER"], to: "SUBMITTED" }],
  ORGANIZER_EDIT: [
    { from: ["DRAFT"], actors: ["ORGANIZER"], to: "DRAFT" },
    { from: ["SUBMITTED"], actors: ["ORGANIZER"], to: "SUBMITTED" },
    { from: ["QUOTED"], actors: ["ORGANIZER"], to: "SUBMITTED" },
  ],
  STAFF_EDIT: [{ from: ["SUBMITTED", "QUOTED"], actors: ["STAFF"], to: "SUBMITTED" }],
  SEND_QUOTE: [{ from: ["SUBMITTED"], actors: ["STAFF"], to: "QUOTED" }],
  ACCEPT: [{ from: ["QUOTED"], actors: ["ORGANIZER"], to: "ACCEPTED" }],
  REOPEN: [{ from: ["ACCEPTED"], actors: ["STAFF"], to: "SUBMITTED" }],
  REJECT: [{ from: ["SUBMITTED", "QUOTED"], actors: ["STAFF"], to: "REJECTED" }],
  CANCEL: [
    { from: ["DRAFT", "SUBMITTED", "QUOTED", "ACCEPTED"], actors: ["ORGANIZER"], to: "CANCELLED" },
  ],
  MARK_PAID: [{ from: ["ACCEPTED"], actors: ["SYSTEM", "STAFF"], to: "PAID" }],
  START_PRODUCTION: [{ from: ["PAID"], actors: ["STAFF"], to: "IN_PRODUCTION" }],
  MARK_READY: [{ from: ["IN_PRODUCTION"], actors: ["STAFF"], to: "READY" }],
  COMPLETE: [{ from: ["READY"], actors: ["STAFF"], to: "COMPLETED" }],
  TEMPLATE_CHANGED: [
    { from: ["DRAFT"], actors: ["SYSTEM"], to: "DRAFT" },
    { from: ["SUBMITTED", "QUOTED", "ACCEPTED"], actors: ["SYSTEM"], to: "SUBMITTED" },
  ],
};

// Fonction pure : statut d'arrivée, ou null si la combinaison est refusée.
export function nextStatus(
  status: PrintRequestStatus,
  action: PrintRequestAction,
  actor: PrintRequestActor,
): PrintRequestStatus | null {
  const rule = RULES[action].find((r) => r.from.includes(status) && r.actors.includes(actor));
  return rule ? rule.to : null;
}
