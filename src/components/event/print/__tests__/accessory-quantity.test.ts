import { describe, expect, it } from "vitest";
import { withBadgeQuantity } from "../accessory-quantity";

describe("withBadgeQuantity", () => {
  const choices = [{ optionId: "o1", valueId: "v1" }] as never;

  it("remplace la quantité et conserve les choix", () => {
    expect(withBadgeQuantity({ quantity: 3, choices }, 120)).toEqual({ quantity: 120, choices });
  });

  it("une quantité NaN devient le nombre de badges", () => {
    expect(withBadgeQuantity({ quantity: NaN, choices: [] }, 40).quantity).toBe(40);
  });

  it("n'altère pas l'entrée", () => {
    const input = { quantity: 3, choices: [] };
    withBadgeQuantity(input, 9);
    expect(input.quantity).toBe(3);
  });
});
