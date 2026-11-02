import type { PrintRequestStatus, PrintRequestType, StaffRole } from "@prisma/client";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { pxToMm } from "@/lib/print-sheets/units";

// Fonctions pures de l'écran staff d'une commande d'impression (testées sans rendu).

export type StaffAction =
  | "SEND_QUOTE"
  | "REJECT"
  | "REOPEN"
  | "MARK_PAID"
  | "START_PRODUCTION"
  | "MARK_READY"
  | "COMPLETE";

// Rôle minimal par action, aligné sur les routes /api/platform/print/requests/**.
const ACTION_ROLE: Record<StaffAction, StaffRole> = {
  SEND_QUOTE: "STAFF_ADMIN",
  REJECT: "STAFF_SUPPORT",
  REOPEN: "STAFF_ADMIN",
  MARK_PAID: "STAFF_ADMIN",
  START_PRODUCTION: "STAFF_SUPPORT",
  MARK_READY: "STAFF_SUPPORT",
  COMPLETE: "STAFF_SUPPORT",
};

const ACTIONS_BY_STATUS: Partial<Record<PrintRequestStatus, StaffAction[]>> = {
  SUBMITTED: ["SEND_QUOTE", "REJECT"],
  QUOTED: ["REJECT"],
  ACCEPTED: ["MARK_PAID", "REOPEN"],
  PAID: ["START_PRODUCTION"],
  IN_PRODUCTION: ["MARK_READY"],
  READY: ["COMPLETE"],
};

// Actions de statut proposées : celles de l'état courant que le rôle a le droit d'appeler.
export function availableActions(status: PrintRequestStatus, role: StaffRole): StaffAction[] {
  return (ACTIONS_BY_STATUS[status] ?? []).filter((a) => staffRoleAtLeast(role, ACTION_ROLE[a]));
}

// Lignes éditables : STAFF_ADMIN, tant que la commande est envoyée ou en devis.
export function canEditQuote(status: PrintRequestStatus, role: StaffRole): boolean {
  return (status === "SUBMITTED" || status === "QUOTED") && staffRoleAtLeast(role, "STAFF_ADMIN");
}

// Lien « Générer les planches » : commande en amont payée (ruling C7 : PAID à READY), STAFF_SUPPORT.
export function canGenerateSheets(
  status: PrintRequestStatus,
  type: PrintRequestType,
  role: StaffRole,
): boolean {
  return (
    type === "ADVANCE" &&
    (status === "PAID" || status === "IN_PRODUCTION" || status === "READY") &&
    staffRoleAtLeast(role, "STAFF_SUPPORT")
  );
}

// Badges de la commande pas encore marqués imprimés (identifiants à envoyer à la route d'impression).
export function unprintedIds(items: { registrationId: string; badgePrinted: boolean }[]): string[] {
  return items.filter((i) => !i.badgePrinted).map((i) => i.registrationId);
}

// Une remise se saisit en montant positif et se stocke en prix unitaire négatif.
export function signedUnitPrice(kind: "PRODUCT" | "SERVICE" | "DISCOUNT" | "CUSTOM", amount: number): number {
  const abs = Math.abs(amount);
  return kind === "DISCOUNT" ? -abs : abs;
}

// Format du badge en millimètres, arrondi au demi-millimètre près (ex. « 85,6 × 54 mm »).
export function formatBadgeSize(widthPx: number, heightPx: number): string {
  const fmt = (px: number) => String(Math.round(pxToMm(px) * 10) / 10).replace(".", ",");
  return `${fmt(widthPx)} × ${fmt(heightPx)} mm`;
}
