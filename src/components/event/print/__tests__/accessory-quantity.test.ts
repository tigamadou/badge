import { describe, expect, it } from "vitest";
import {
  accessoryBlockedReason,
  belowBadgeCountWarning,
  capConfiguration,
  capQuantity,
  followedQuantity,
  trackBadgeCount,
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

describe("trackBadgeCount : suivi du nombre de badges", () => {
  it("un nombre invalide (0, NaN) ne change rien et garde la référence précédente", () => {
    expect(trackBadgeCount(100, 0)).toEqual({ tracked: 100, follow: false });
    expect(trackBadgeCount(100, Number.NaN)).toEqual({ tracked: 100, follow: false });
  });

  it("100 -> 0 -> 50 : l'accessoire à 100 suit finalement 50", () => {
    const afterZero = trackBadgeCount(100, 0);
    const afterFifty = trackBadgeCount(afterZero.tracked, 50);
    expect(afterFifty).toEqual({ tracked: 50, follow: true, previous: 100 });
    expect(followedQuantity(100, afterFifty.previous!, 50)).toBe(50);
  });

  it("première saisie ou valeur identique : pas de suivi", () => {
    expect(trackBadgeCount(0, 40)).toEqual({ tracked: 40, follow: false });
    expect(trackBadgeCount(40, 40)).toEqual({ tracked: 40, follow: false });
  });
});
