import { formatFcfa } from "@/lib/print-requests/labels";

export const NOT_OWNER_MESSAGE = "Seul le propriétaire de l'organisation peut payer ce devis.";
export const PENDING_NOTICE = "Un paiement est en cours. Vous pouvez le reprendre.";

const FALLBACK = "Le paiement n'a pas pu démarrer. Réessayez.";

const ERROR_MESSAGES: Record<string, string> = {
  PAYMENT_IN_PROGRESS: "Un paiement est déjà en cours d'ouverture. Réessayez dans un instant.",
  PAYMENTS_DISABLED: "Le paiement en ligne n'est pas disponible pour le moment.",
  REQUEST_NOT_PAYABLE: "Ce devis n'est plus payable. Rechargez la page.",
  REQUEST_ALREADY_PAID: "Ce devis vient d'être payé.",
};

// La page est périmée (le devis est déjà payé) : il faut la rafraîchir pour afficher le nouvel état.
export function shouldRefreshAfterPayError(code: string | null): boolean {
  return code === "REQUEST_ALREADY_PAID";
}

// Message français pour le code d'erreur `{ error }` de la route de checkout.
export function payErrorMessage(code: string | null): string {
  return (code && ERROR_MESSAGES[code]) || FALLBACK;
}

export function payButtonLabel(amount: number): string {
  return `Payer ${formatFcfa(amount)}`;
}

export function hasPendingPayment(payments: { status: string }[]): boolean {
  return payments.some((p) => p.status === "PENDING");
}

// « Payer » n'a de sens que pour un montant strictement positif : un devis entièrement couvert par le
// crédit d'impression passe PAID à l'acceptation et ne se paie pas.
export function canShowPayButton(amount: number): boolean {
  return amount > 0;
}
