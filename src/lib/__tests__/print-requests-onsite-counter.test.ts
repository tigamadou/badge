import { describe, expect, it } from "vitest";
import {
  computeOnsiteCounter,
  onsiteCap,
  orderedBadgeLine,
} from "@/lib/print-requests/onsite-counter";

describe("onsiteCap", () => {
  it("plafond : 200 et 10 % -> 220 ; 200 et 0 % -> 200 ; 7 et 10 % -> 8 (arrondi supérieur)", () => {
    expect(onsiteCap(200, 10)).toBe(220);
    expect(onsiteCap(200, 0)).toBe(200);
    expect(onsiteCap(7, 10)).toBe(8);
    expect(onsiteCap(10, 10)).toBe(11);
  });
});

describe("computeOnsiteCounter", () => {
  const at = (printed: number) => computeOnsiteCounter({ ordered: 200, marginPercent: 10, printed });

  it("179 imprimés sur 200 -> NORMAL ; 180 -> WARNING ; 200 -> WARNING", () => {
    expect(at(179).level).toBe("NORMAL");
    expect(at(180).level).toBe("WARNING");
    expect(at(200).level).toBe("WARNING");
  });

  it("212 imprimés sur 200 à 10 % -> OVER, beyondOrder 12, remainingToCap 8", () => {
    expect(at(212)).toEqual({
      ordered: 200,
      marginPercent: 10,
      cap: 220,
      printed: 212,
      beyondOrder: 12,
      remainingToCap: 8,
      level: "OVER",
    });
  });

  it("220 imprimés -> CAP_REACHED, remainingToCap 0", () => {
    const c = at(220);
    expect(c.level).toBe("CAP_REACHED");
    expect(c.remainingToCap).toBe(0);
    expect(at(230).remainingToCap).toBe(0);
  });

  it("marge 0 % : printed == ordered -> CAP_REACHED", () => {
    const c = computeOnsiteCounter({ ordered: 200, marginPercent: 0, printed: 200 });
    expect(c.level).toBe("CAP_REACHED");
    expect(c.beyondOrder).toBe(0);
  });

  it("avant la commande, beyondOrder vaut 0", () => {
    expect(at(10).beyondOrder).toBe(0);
  });
});

describe("orderedBadgeLine", () => {
  const badge = { kind: "PRODUCT", quantity: 200, unitPrice: 1500, removedAt: null, product: { kind: "BADGE" } };

  it("ignore les accessoires et les lignes retirées -> { quantity: 200, unitPrice: 1500 }", () => {
    const lines = [
      { ...badge, quantity: 50, removedAt: new Date() },
      { ...badge, quantity: 30, unitPrice: 500, product: { kind: "ACCESSORY" } },
      { ...badge, kind: "FEE", product: null },
      badge,
    ];
    expect(orderedBadgeLine(lines)).toEqual({ quantity: 200, unitPrice: 1500 });
  });

  it("aucune ligne BADGE -> null", () => {
    expect(orderedBadgeLine([])).toBeNull();
    expect(orderedBadgeLine([{ ...badge, product: null }])).toBeNull();
  });
});
