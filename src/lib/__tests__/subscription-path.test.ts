import { describe, expect, it } from "vitest";
import { isAlwaysAllowedOrgPath, isSubscriptionPath } from "@/lib/subscription-path";

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

describe("isAlwaysAllowedOrgPath", () => {
  it("accepte l'onglet abonnement et sa page de retour", () => {
    expect(isAlwaysAllowedOrgPath("/org/o1/subscription", "o1")).toBe(true);
    expect(isAlwaysAllowedOrgPath("/org/o1/subscription/return", "o1")).toBe(true);
  });
  it("accepte le module Paiements, sa fiche et son reçu", () => {
    expect(isAlwaysAllowedOrgPath("/org/o1/payments", "o1")).toBe(true);
    expect(isAlwaysAllowedOrgPath("/org/o1/payments/p1", "o1")).toBe(true);
    expect(isAlwaysAllowedOrgPath("/org/o1/payments/p1/receipt", "o1")).toBe(true);
    expect(isAlwaysAllowedOrgPath("/org/o1/paymentsX", "o1")).toBe(false);
    expect(isAlwaysAllowedOrgPath("/org/o2/payments", "o1")).toBe(false);
  });
  it("accepte la liste des évènements, avec ou sans slash final", () => {
    expect(isAlwaysAllowedOrgPath("/org/o1/events", "o1")).toBe(true);
    expect(isAlwaysAllowedOrgPath("/org/o1/events/", "o1")).toBe(true);
  });
  it("refuse la création d'évènement et les autres pages", () => {
    expect(isAlwaysAllowedOrgPath("/org/o1/events/new", "o1")).toBe(false);
    expect(isAlwaysAllowedOrgPath("/org/o1/members", "o1")).toBe(false);
  });
  it("refuse la liste d'une autre organisation et un préfixe collé", () => {
    expect(isAlwaysAllowedOrgPath("/org/o2/events", "o1")).toBe(false);
    expect(isAlwaysAllowedOrgPath("/org/o1/eventsX", "o1")).toBe(false);
  });
  it("refuse une chaîne vide", () => {
    expect(isAlwaysAllowedOrgPath("", "o1")).toBe(false);
  });
});
