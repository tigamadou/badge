import { describe, expect, it } from "vitest";
import { isSubscriptionPath } from "@/lib/subscription-path";

describe("isSubscriptionPath", () => {
  it("accepte le chemin exact", () => {
    expect(isSubscriptionPath("/org/o1/subscription", "o1")).toBe(true);
  });
  it("accepte un sous-chemin", () => {
    expect(isSubscriptionPath("/org/o1/subscription/return", "o1")).toBe(true);
  });
  it("refuse un préfixe collé", () => {
    expect(isSubscriptionPath("/org/o1/subscriptionX", "o1")).toBe(false);
  });
  it("refuse l'abonnement d'une autre organisation", () => {
    expect(isSubscriptionPath("/org/o2/subscription", "o1")).toBe(false);
  });
  it("refuse une chaîne vide", () => {
    expect(isSubscriptionPath("", "o1")).toBe(false);
  });
});
