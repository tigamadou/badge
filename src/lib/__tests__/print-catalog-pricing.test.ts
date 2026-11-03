import { describe, it, expect } from "vitest";
import {
  tierPriceFor, startingPrice, unitPriceFor, formatFcfa,
  type PricingOption, type ProductForPricing,
} from "@/lib/print-catalog/pricing-core";
import { CORDON, v } from "./helpers/print-products";

const withOption = (option: PricingOption): ProductForPricing => ({
  ...CORDON, priceTiers: [], options: [option],
});

describe("tierPriceFor", () => {
  it("99 -> 500, 100 -> 450, 499 -> 450, 500 -> 400, 10000 -> 400", () => {
    expect(tierPriceFor(CORDON, 99)).toBe(500);
    expect(tierPriceFor(CORDON, 100)).toBe(450);
    expect(tierPriceFor(CORDON, 499)).toBe(450);
    expect(tierPriceFor(CORDON, 500)).toBe(400);
    expect(tierPriceFor(CORDON, 10000)).toBe(400);
  });
  it("sans palier -> basePrice", () => {
    expect(tierPriceFor({ basePrice: 500, priceTiers: [] }, 1000)).toBe(500);
  });
  it("ne dépend pas de l'ordre des paliers", () => {
    const reversed = { basePrice: 500, priceTiers: [...CORDON.priceTiers].reverse() };
    expect(tierPriceFor(reversed, 500)).toBe(400);
    expect(tierPriceFor(reversed, 100)).toBe(450);
  });
});

describe("startingPrice", () => {
  it("CORDON = 400 ; sans palier = basePrice ; palier plus cher que la base ignoré", () => {
    expect(startingPrice(CORDON)).toBe(400);
    expect(startingPrice({ basePrice: 500, priceTiers: [] })).toBe(500);
    expect(startingPrice({ basePrice: 500, priceTiers: [{ minQuantity: 10, unitPrice: 900 }] })).toBe(500);
  });
});

describe("unitPriceFor", () => {
  it("cordon x50, Rouge, sans texte : 500", () => {
    expect(unitPriceFor(CORDON, 50, [{ optionId: "o-color", valueIds: ["rouge"] }])).toBe(500);
  });
  it("cordon x100, Or, texte : 450 + 100 + 150 = 700", () => {
    expect(unitPriceFor(CORDON, 100, [
      { optionId: "o-color", valueIds: ["or"] },
      { optionId: "o-text", text: "Forum 2026" },
    ])).toBe(700);
  });
  it("cordon x600, Bleu, texte : 400 + 150 = 550", () => {
    expect(unitPriceFor(CORDON, 600, [
      { optionId: "o-color", valueIds: ["bleu"] },
      { optionId: "o-text", text: "Forum" },
    ])).toBe(550);
  });
  it("texte vide ou blanc ou absent : pas de supplément", () => {
    expect(unitPriceFor(CORDON, 100, [{ optionId: "o-text", text: "   " }])).toBe(450);
    expect(unitPriceFor(CORDON, 100, [{ optionId: "o-text" }])).toBe(450);
  });
  it("CHOICE / COLOR sans valeur choisie : pas de supplément", () => {
    expect(unitPriceFor(CORDON, 100, [{ optionId: "o-color" }])).toBe(450);
  });
  it("MULTI_CHOICE : somme des valeurs choisies", () => {
    const p = withOption({
      id: "o-fin", name: "Finitions", help: null, type: "MULTI_CHOICE", required: false,
      priceDelta: 0, maxLength: null, archived: false,
      values: [v("a", "A", null, 30), v("b", "B", null, 20), v("c", "C", null, 99)],
    });
    expect(unitPriceFor(p, 50, [{ optionId: "o-fin", valueIds: ["a", "b"] }])).toBe(550);
  });
  it("FILE : supplément si fileKey présent, rien sinon", () => {
    const p = withOption({
      id: "o-file", name: "Logo", help: null, type: "FILE", required: false,
      priceDelta: 200, maxLength: null, archived: false, values: [],
    });
    expect(unitPriceFor(p, 50, [{ optionId: "o-file", fileKey: "k" }])).toBe(700);
    expect(unitPriceFor(p, 50, [{ optionId: "o-file" }])).toBe(500);
  });
  describe("QUANTITY_SPLIT", () => {
    const split = withOption({
      id: "o-split", name: "Répartition", help: null, type: "QUANTITY_SPLIT", required: true,
      priceDelta: 0, maxLength: null, archived: false,
      values: [v("rouge", "Rouge", null, 0), v("or", "Or", null, 100)],
    });
    const cordonSplit: ProductForPricing = { ...split, priceTiers: CORDON.priceTiers };
    it("x200 : Rouge 120 (0), Or 80 (+100) -> 450 + 40 = 490", () => {
      expect(unitPriceFor(cordonSplit, 200, [{ optionId: "o-split", split: [
        { valueId: "rouge", quantity: 120 }, { valueId: "or", quantity: 80 }] }])).toBe(490);
    });
    it("x3 : Or 1, Rouge 2 -> 500 + round(33,33) = 533", () => {
      expect(unitPriceFor(split, 3, [{ optionId: "o-split", split: [
        { valueId: "or", quantity: 1 }, { valueId: "rouge", quantity: 2 }] }])).toBe(533);
    });
    it("quantité <= 0 -> supplément 0 (pas de NaN)", () => {
      const choices = [{ optionId: "o-split", split: [{ valueId: "or", quantity: 5 }] }];
      expect(unitPriceFor(split, 0, choices)).toBe(500);
      expect(unitPriceFor(split, -4, choices)).toBe(500);
    });
    it("répartition absente ou valeur inconnue : ignorée", () => {
      expect(unitPriceFor(split, 10, [{ optionId: "o-split" }])).toBe(500);
      expect(unitPriceFor(split, 10, [{ optionId: "o-split", split: [{ valueId: "zz", quantity: 10 }] }])).toBe(500);
    });
  });
  it("option ou valeur inconnue ignorée", () => {
    expect(unitPriceFor(CORDON, 100, [
      { optionId: "inconnue", valueIds: ["or"] },
      { optionId: "o-color", valueIds: ["inconnue"] },
    ])).toBe(450);
  });
});

describe("formatFcfa", () => {
  it("70000 -> « 70 000 FCFA », 0 -> « 0 FCFA »", () => {
    expect(formatFcfa(70000)).toBe("70 000 FCFA");
    expect(formatFcfa(0)).toBe("0 FCFA");
    expect(formatFcfa(1234567)).toBe("1 234 567 FCFA");
  });
});
