import { describe, it, expect } from "vitest";
import { payErrorMessage, payButtonLabel, hasPendingPayment, NOT_OWNER_MESSAGE, PENDING_NOTICE } from "../pay-button";

describe("payErrorMessage", () => {
  it.each([
    ["PAYMENT_IN_PROGRESS", "Un paiement est déjà en cours d'ouverture. Réessayez dans un instant."],
    ["PAYMENTS_DISABLED", "Le paiement en ligne n'est pas disponible pour le moment."],
    ["REQUEST_NOT_PAYABLE", "Ce devis n'est plus payable. Rechargez la page."],
    ["PROVIDER_ERROR", "Le paiement n'a pas pu démarrer. Réessayez."],
    ["INCONNU", "Le paiement n'a pas pu démarrer. Réessayez."],
    [null, "Le paiement n'a pas pu démarrer. Réessayez."],
  ])("%s", (code, message) => {
    expect(payErrorMessage(code)).toBe(message);
  });
});

describe("payButtonLabel", () => {
  it("formate le montant en FCFA", () => {
    expect(payButtonLabel(150000).replace(/\s/g, " ")).toBe("Payer 150 000 FCFA");
  });
});

describe("hasPendingPayment", () => {
  it("vrai si un paiement est en attente", () => {
    expect(hasPendingPayment([{ status: "APPROVED" }, { status: "PENDING" }])).toBe(true);
  });
  it("faux sinon", () => {
    expect(hasPendingPayment([{ status: "APPROVED" }])).toBe(false);
    expect(hasPendingPayment([])).toBe(false);
  });
});

describe("messages", () => {
  it("textes fixes", () => {
    expect(NOT_OWNER_MESSAGE).toBe("Seul le propriétaire de l'organisation peut payer ce devis.");
    expect(PENDING_NOTICE).toBe("Un paiement est en cours. Vous pouvez le reprendre.");
  });
});
