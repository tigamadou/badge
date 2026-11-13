import type { Permission } from "@/lib/permissions/catalog";
import { describe, it, expect } from "vitest";
import {
  canApplyCredit,
  creditOfferSentence,
  creditWarning,
  defaultCreditAmount,
  movementLabel,
  showsCreditCard,
  showsCreditOffer,
} from "@/lib/print-requests/credit-view";

// Séparateur de milliers de formatFcfa : espace fine insécable (fr-FR).
const n = (s: string) => s.replace(/(\d) (?=\d{3})/g, "$1\u202f");

describe("movementLabel", () => {
  it("EARNED avec quantité et référence", () => {
    expect(movementLabel({ kind: "EARNED", amount: 45000, quantity: 30, request: { reference: "IMP-1" } })).toBe(
      n("+ 45 000 FCFA — 30 badges non utilisés — IMP-1"),
    );
  });
  it("EARNED au singulier, sans référence ni quantité", () => {
    expect(movementLabel({ kind: "EARNED", amount: 1500, quantity: 1, request: null })).toBe(
      n("+ 1 500 FCFA — 1 badge non utilisé"),
    );
    expect(movementLabel({ kind: "EARNED", amount: 1500, quantity: null, request: null })).toBe(n("+ 1 500 FCFA"));
  });
  it("SPENT : montant en valeur absolue", () => {
    expect(movementLabel({ kind: "SPENT", amount: -45000, quantity: null, request: { reference: "IMP-2" } })).toBe(
      n("− 45 000 FCFA — appliqué à IMP-2"),
    );
    expect(movementLabel({ kind: "SPENT", amount: -500, quantity: null, request: null })).toBe("− 500 FCFA — appliqué");
  });
});

describe("visibilité", () => {
  it("carte : solde non nul ou historique", () => {
    expect(showsCreditCard(0, 0)).toBe(false);
    expect(showsCreditCard(0, 2)).toBe(true);
    expect(showsCreditCard(10, 0)).toBe(true);
  });
  it("proposition : SUBMITTED ou QUOTED avec crédit disponible", () => {
    expect(showsCreditOffer("SUBMITTED", 1)).toBe(true);
    expect(showsCreditOffer("QUOTED", 1)).toBe(true);
    expect(showsCreditOffer("QUOTED", 0)).toBe(false);
    expect(showsCreditOffer("ACCEPTED", 5)).toBe(false);
    expect(showsCreditOffer("DRAFT", 5)).toBe(false);
  });
  it("application : STAFF_ADMIN, statut ouvert, crédit à appliquer", () => {
    expect(canApplyCredit("SUBMITTED", "STAFF_ADMIN", 100, 500)).toBe(true);
    expect(canApplyCredit("QUOTED", "SUPER_ADMIN", 100, 500)).toBe(true);
    expect(canApplyCredit("QUOTED", "STAFF_SUPPORT", 100, 500)).toBe(false);
    expect(canApplyCredit("ACCEPTED", "STAFF_ADMIN", 100, 500)).toBe(false);
    expect(canApplyCredit("QUOTED", "STAFF_ADMIN", 0, 500)).toBe(false);
    expect(canApplyCredit("QUOTED", "STAFF_ADMIN", 100, 0)).toBe(false);
  });
  it("application avec un ensemble de permissions : vrai ssi `print.requests.credit.apply`", () => {
    const granted = new Set<Permission>(["print.requests.credit.apply"]);
    expect(canApplyCredit("QUOTED", granted, 100, 500)).toBe(true);
    expect(canApplyCredit("QUOTED", new Set<Permission>(["print.request"]), 100, 500)).toBe(false);
    expect(canApplyCredit("ACCEPTED", granted, 100, 500)).toBe(false);
    expect(canApplyCredit("QUOTED", granted, 0, 500)).toBe(false);
  });
});

describe("montants", () => {
  it("pré-remplissage : min(disponible, total)", () => {
    expect(defaultCreditAmount(45000, 30000)).toBe(30000);
    expect(defaultCreditAmount(20000, 30000)).toBe(20000);
  });
  it("avertissement quand le crédit dépasse le total des lignes", () => {
    expect(creditWarning(0, 0)).toBeNull();
    expect(creditWarning(30000, 30000)).toBeNull();
    expect(creditWarning(30000, 20000)).toBe(
      n("Le crédit appliqué (30 000 FCFA) dépasse le total des autres lignes (20 000 FCFA) : l'organisateur a réduit ses quantités. Le devis ne peut pas être envoyé tant que le crédit n'est pas réduit."),
    );
  });
  it("phrase de proposition", () => {
    expect(creditOfferSentence(45000)).toBe(
      n("Votre organisation dispose de 45 000 FCFA de crédit d'impression ; l'équipe Badge pourra l'appliquer à ce devis."),
    );
  });
});
