import { NextResponse } from "next/server";

export type PrintRequestErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "INVALID_TRANSITION"
  | "PAYMENT_IN_PROGRESS"
  | "QUOTE_ACCEPTED"
  | "REQUEST_LOCKED"
  | "REGISTRATIONS_TAKEN"
  | "INVALID_SELECTION"
  | "EMPTY_SELECTION"
  | "TYPE_MISMATCH"
  | "BADGE_PRODUCT_REQUIRED"
  | "BADGE_COUNT_REQUIRED"
  | "PRODUCT_UNAVAILABLE"
  | "INVALID_CHOICES"
  | "BELOW_MIN_QUANTITY"
  | "LINE_LOCKED_BY_STAFF"
  | "DELIVERY_INCOMPLETE"
  | "ONSITE_INCOMPLETE"
  | "QUOTE_VERSION_MISMATCH"
  | "EMPTY_QUOTE"
  | "NEGATIVE_TOTAL"
  | "OWNER_REQUIRED"
  | "STAFF_FORBIDDEN"
  | "INVALID_ATTACHMENT"
  | "TEMPLATE_LOCKED_BY_PRINT_REQUEST"
  | "CREDIT_LINE_LOCKED";

export class PrintRequestError extends Error {
  constructor(
    readonly code: PrintRequestErrorCode,
    readonly status: 400 | 403 | 404 | 409,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "PrintRequestError";
  }
}

// Messages en français affichés par toastApiError (qui lit `message`).
export const PRINT_REQUEST_ERROR_MESSAGES: Record<PrintRequestErrorCode, string> = {
  NOT_FOUND: "Demande introuvable.",
  VALIDATION: "Les informations saisies sont invalides.",
  INVALID_TRANSITION: "Cette action n'est pas possible dans l'état actuel de la demande.",
  PAYMENT_IN_PROGRESS: "Un paiement est en cours pour cette demande. Réessayez dans quelques instants.",
  QUOTE_ACCEPTED: "Le devis est déjà accepté : il ne peut plus être modifié.",
  REQUEST_LOCKED: "Cette demande ne peut plus être modifiée.",
  REGISTRATIONS_TAKEN: "Certains badges sont déjà inclus dans une autre demande d'impression.",
  INVALID_SELECTION: "La sélection de badges est invalide.",
  EMPTY_SELECTION: "Sélectionnez au moins un badge.",
  TYPE_MISMATCH: "Ce produit ne correspond pas au type de la demande.",
  BADGE_PRODUCT_REQUIRED: "Choisissez un support de badge pour cette demande.",
  BADGE_COUNT_REQUIRED: "Indiquez le nombre de badges à imprimer.",
  PRODUCT_UNAVAILABLE: "Ce produit n'est plus disponible.",
  INVALID_CHOICES: "Les options choisies pour ce produit sont invalides.",
  BELOW_MIN_QUANTITY: "La quantité est inférieure au minimum de commande du produit.",
  LINE_LOCKED_BY_STAFF: "Cette ligne a été fixée par l'équipe et ne peut pas être modifiée.",
  DELIVERY_INCOMPLETE: "Complétez les informations de livraison.",
  ONSITE_INCOMPLETE: "Complétez les informations d'impression sur place.",
  QUOTE_VERSION_MISMATCH: "Le devis a changé entre-temps. Rechargez la page.",
  EMPTY_QUOTE: "Le devis ne contient aucune ligne.",
  NEGATIVE_TOTAL: "Le total du devis ne peut pas être négatif.",
  OWNER_REQUIRED: "Seul un propriétaire de l'organisation peut effectuer cette action.",
  STAFF_FORBIDDEN: "Cette action n'est pas disponible pour l'équipe.",
  INVALID_ATTACHMENT: "La pièce jointe est invalide.",
  TEMPLATE_LOCKED_BY_PRINT_REQUEST:
    "Ce template est utilisé par une demande d'impression en cours et ne peut pas être modifié.",
  CREDIT_LINE_LOCKED: "Cette ligne de crédit est verrouillée et ne peut pas être modifiée.",
};

// `details` est envoyé au client par conception : n'y mettre aucune donnée interne.
// `error` reste le code ; `message` est le texte français destiné à l'utilisateur.
export function printRequestErrorResponse(err: unknown): NextResponse {
  if (err instanceof PrintRequestError) {
    return NextResponse.json(
      { ...err.details, error: err.code, message: PRINT_REQUEST_ERROR_MESSAGES[err.code] },
      { status: err.status },
    );
  }
  throw err;
}
