import { describe, expect, it } from "vitest";
import { parseQuoteMessage } from "../quote-message";

describe("parseQuoteMessage", () => {
  it("reconnaît un récapitulatif de première version", () => {
    expect(parseQuoteMessage("Devis v1 : 2 ligne(s)\n• Ligne ajoutée : Cordon (100 × 450 FCFA)\n• Ligne ajoutée : Badge\nTotal : 90 000 FCFA")).toEqual({
      version: 1,
      total: "90 000 FCFA",
      rows: ["Ligne ajoutée : Cordon (100 × 450 FCFA)", "Ligne ajoutée : Badge"],
    });
  });

  it("reconnaît une version avec modifications depuis la précédente", () => {
    const parsed = parseQuoteMessage("Devis v2 : modifications depuis la version précédente\n• Aucune ligne modifiée.\nTotal : 1 FCFA");
    expect(parsed).toMatchObject({ version: 2, rows: ["Aucune ligne modifiée."] });
  });

  it("renvoie null pour un autre texte", () => {
    expect(parseQuoteMessage("Bonjour")).toBeNull();
    expect(parseQuoteMessage("Devis v1 : x\nTotal : 1")).toBeNull();
    expect(parseQuoteMessage("Devis v1 : x\nligne libre\nTotal : 1")).toBeNull();
    expect(parseQuoteMessage("Devis v1 : x")).toBeNull();
  });
});
