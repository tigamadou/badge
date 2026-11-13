import type { PrintRequestStatus, PrintRequestType } from "@prisma/client";
import type { Permission } from "@/lib/permissions";
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

// Permission requise par action, alignée sur les routes /api/platform/print/requests/**.
const ACTION_PERMISSION: Record<StaffAction, Permission> = {
  SEND_QUOTE: "print.requests.quote.send",
  REJECT: "print.requests.reject",
  REOPEN: "print.requests.reopen",
  MARK_PAID: "print.requests.mark_paid",
  START_PRODUCTION: "print.requests.advance",
  MARK_READY: "print.requests.advance",
  COMPLETE: "print.requests.advance",
};

const ACTIONS_BY_STATUS: Partial<Record<PrintRequestStatus, StaffAction[]>> = {
  SUBMITTED: ["SEND_QUOTE", "REJECT"],
  QUOTED: ["REJECT"],
  ACCEPTED: ["MARK_PAID", "REOPEN"],
  PAID: ["START_PRODUCTION"],
  IN_PRODUCTION: ["MARK_READY"],
  READY: ["COMPLETE"],
};

// Clore une commande sur place verse un crédit ou crée une facture : droit dédié, comme la route.
function requiredPermission(action: StaffAction, type: PrintRequestType): Permission {
  return action === "COMPLETE" && type === "ONSITE" ? "print.requests.onsite.complete" : ACTION_PERMISSION[action];
}

// Actions de statut proposées : celles de l'état courant que les permissions autorisent à appeler.
export function availableActions(
  status: PrintRequestStatus,
  type: PrintRequestType,
  permissions: ReadonlySet<Permission>,
): StaffAction[] {
  return (ACTIONS_BY_STATUS[status] ?? []).filter((a) => permissions.has(requiredPermission(a, type)));
}

// Lignes éditables tant que la commande est envoyée ou en devis, avec `print.requests.quote.edit`.
export function canEditQuote(status: PrintRequestStatus, permissions: ReadonlySet<Permission>): boolean {
  return (status === "SUBMITTED" || status === "QUOTED") && permissions.has("print.requests.quote.edit");
}

// Lien « Générer les planches » : commande en amont payée (ruling C7 : PAID à READY), `print.sheets.generate`.
export function canGenerateSheets(
  status: PrintRequestStatus,
  type: PrintRequestType,
  permissions: ReadonlySet<Permission>,
): boolean {
  return (
    type === "ADVANCE" &&
    (status === "PAID" || status === "IN_PRODUCTION" || status === "READY") &&
    permissions.has("print.sheets.generate")
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
