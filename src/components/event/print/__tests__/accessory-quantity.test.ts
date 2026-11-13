import { describe, expect, it } from "vitest";
import {
  accessoryBlockedReason,
  belowBadgeCountWarning,
  capConfiguration,
  capQuantity,
  followedQuantity,
} from "../accessory-quantity";

describe("accessory-quantity (spec 39 révisée)", () => {
  it("capQuantity ramène une saisie supérieure et laisse le reste", () => {
    expect(capQuantity(150, 100)).toBe(100);
    expect(capQuantity(40, 100)).toBe(40);
    expect(capQuantity(NaN, 100)).toBeNaN();
  });

  it("capConfiguration conserve les choix et n'altère pas l'entrée", () => {
    const input = { quantity: 500, choices: [] };
    expect(capConfiguration(input, 100)).toEqual({ quantity: 100, choices: [] });
    expect(input.quantity).toBe(500);
  });

  it("followedQuantity : égale suit, supérieure ramenée, inférieure conservée", () => {
    expect(followedQuantity(100, 100, 80)).toBe(80);
    expect(followedQuantity(100, 100, 120)).toBe(120);
    expect(followedQuantity(90, 100, 80)).toBe(80);
    expect(followedQuantity(50, 100, 80)).toBe(50);
    expect(followedQuantity(NaN, 100, 80)).toBeNaN();
  });

  it("accessoryBlockedReason : minimum supérieur au nombre de badges", () => {
    expect(accessoryBlockedReason({ minQuantity: 200 }, 100)).toBe("Minimum de 200, supérieur au nombre de badges (100)");
    expect(accessoryBlockedReason({ minQuantity: 100 }, 100)).toBeNull();
  });

  it("belowBadgeCountWarning : seulement si inférieure", () => {
    expect(belowBadgeCountWarning(40, 100)).toBe("Quantité inférieure au nombre de badges de la commande (100).");
    expect(belowBadgeCountWarning(100, 100)).toBeNull();
    expect(belowBadgeCountWarning(NaN, 100)).toBeNull();
  });
});
