import type { OrgPrintCreditKind, PrintRequestStatus } from "@prisma/client";
import type { Permission } from "@/lib/permissions/catalog";
import { formatFcfa } from "@/lib/print-catalog/pricing-core";

// Logique pure des écrans du crédit d'impression (libellés, visibilité, montants).
// Aucun accès à la base : le module reste utilisable côté navigateur.

export type CreditMovementView = {
  id: string;
  kind: OrgPrintCreditKind;
  /** Positif pour EARNED, négatif pour SPENT. */
  amount: number;
  quantity: number | null;
  /** Null quand la commande a été supprimée (le mouvement est conservé). */
  request: { reference: string } | null;
};

// « + 45 000 FCFA — 30 badges non utilisés — IMP-… » ou « − 45 000 FCFA — appliqué à IMP-… ».
export function movementLabel(m: Pick<CreditMovementView, "kind" | "amount" | "quantity" | "request">): string {
  const abs = formatFcfa(Math.abs(m.amount));
  if (m.kind === "SPENT") {
    return `− ${abs} — appliqué${m.request ? ` à ${m.request.reference}` : ""}`;
  }
  const parts = [`+ ${abs}`];
  if (m.quantity !== null) parts.push(`${m.quantity} badge${m.quantity > 1 ? "s" : ""} non utilisé${m.quantity > 1 ? "s" : ""}`);
  if (m.request) parts.push(m.request.reference);
  return parts.join(" — ");
}

// La carte reste affichée tant qu'il y a un solde ou un historique.
export const showsCreditCard = (balance: number, movementCount: number): boolean =>
  balance !== 0 || movementCount > 0;

const OPEN: PrintRequestStatus[] = ["SUBMITTED", "QUOTED"];

// Le crédit est proposé sur toute commande envoyée ou en devis dont l'organisation a du crédit libre.
export const showsCreditOffer = (status: PrintRequestStatus, available: number): boolean =>
  OPEN.includes(status) && available > 0;

// Bouton « Appliquer le crédit » : permission `print.requests.credit.apply`, commande ouverte, et
// quelque chose à appliquer (crédit libre et lignes à couvrir).
export function canApplyCredit(
  status: PrintRequestStatus,
  access: ReadonlySet<Permission>,
  available: number,
  grossTotal: number,
): boolean {
  return OPEN.includes(status) && access.has("print.requests.credit.apply") && available > 0 && grossTotal > 0;
}

// Montant pré-rempli : le plus grand crédit applicable à la commande.
export const defaultCreditAmount = (available: number, grossTotal: number): number => Math.min(available, grossTotal);

// Si l'organisateur baisse ses quantités après l'application, le crédit peut dépasser les autres
// lignes : sendQuote refuse alors (NEGATIVE_TOTAL).
export function creditWarning(applied: number, grossTotal: number): string | null {
  if (applied <= grossTotal) return null;
  return `Le crédit appliqué (${formatFcfa(applied)}) dépasse le total des autres lignes (${formatFcfa(grossTotal)}) : l'organisateur a réduit ses quantités. Le devis ne peut pas être envoyé tant que le crédit n'est pas réduit.`;
}

export const creditOfferSentence = (available: number): string =>
  `Votre organisation dispose de ${formatFcfa(available)} de crédit d'impression ; l'équipe Badge pourra l'appliquer à ce devis.`;
