import { describe, it, expect } from "vitest";
import {
  availableActions,
  canEditQuote,
  canGenerateSheets,
  formatBadgeSize,
  signedUnitPrice,
  unprintedIds,
} from "../request-actions";

describe("availableActions", () => {
  it("SUBMITTED : devis et refus pour un administrateur", () => {
    expect(availableActions("SUBMITTED", "STAFF_ADMIN")).toEqual(["SEND_QUOTE", "REJECT"]);
  });
  it("SUBMITTED : le support ne peut que refuser", () => {
    expect(availableActions("SUBMITTED", "STAFF_SUPPORT")).toEqual(["REJECT"]);
  });
  it("l'observateur n'a aucune action", () => {
    for (const s of ["SUBMITTED", "QUOTED", "ACCEPTED", "PAID", "IN_PRODUCTION", "READY"] as const) {
      expect(availableActions(s, "STAFF_OBSERVER")).toEqual([]);
    }
  });
  it("ACCEPTED : marquer payée et rouvrir réservés à l'administrateur", () => {
    expect(availableActions("ACCEPTED", "STAFF_ADMIN")).toEqual(["MARK_PAID", "REOPEN"]);
    expect(availableActions("ACCEPTED", "STAFF_SUPPORT")).toEqual([]);
  });
  it("production : le support suit la chaîne PAID -> IN_PRODUCTION -> READY -> COMPLETED", () => {
    expect(availableActions("PAID", "STAFF_SUPPORT")).toEqual(["START_PRODUCTION"]);
    expect(availableActions("IN_PRODUCTION", "STAFF_SUPPORT")).toEqual(["MARK_READY"]);
    expect(availableActions("READY", "STAFF_SUPPORT")).toEqual(["COMPLETE"]);
  });
  it("états terminaux : rien", () => {
    for (const s of ["COMPLETED", "REJECTED", "CANCELLED", "DRAFT"] as const) {
      expect(availableActions(s, "SUPER_ADMIN")).toEqual([]);
    }
  });
});

describe("canEditQuote", () => {
  it("STAFF_ADMIN sur SUBMITTED et QUOTED seulement", () => {
    expect(canEditQuote("SUBMITTED", "STAFF_ADMIN")).toBe(true);
    expect(canEditQuote("QUOTED", "SUPER_ADMIN")).toBe(true);
    expect(canEditQuote("ACCEPTED", "STAFF_ADMIN")).toBe(false);
    expect(canEditQuote("SUBMITTED", "STAFF_SUPPORT")).toBe(false);
  });
});

describe("canGenerateSheets", () => {
  it("commande en amont payée, de PAID à READY", () => {
    expect(canGenerateSheets("PAID", "ADVANCE", "STAFF_SUPPORT")).toBe(true);
    expect(canGenerateSheets("READY", "ADVANCE", "STAFF_ADMIN")).toBe(true);
    expect(canGenerateSheets("COMPLETED", "ADVANCE", "STAFF_ADMIN")).toBe(false);
    expect(canGenerateSheets("ACCEPTED", "ADVANCE", "STAFF_ADMIN")).toBe(false);
    expect(canGenerateSheets("PAID", "ONSITE", "STAFF_ADMIN")).toBe(false);
    expect(canGenerateSheets("PAID", "ADVANCE", "STAFF_OBSERVER")).toBe(false);
  });
});

describe("unprintedIds", () => {
  it("ne garde que les badges non imprimés", () => {
    expect(
      unprintedIds([
        { registrationId: "a", badgePrinted: true },
        { registrationId: "b", badgePrinted: false },
      ]),
    ).toEqual(["b"]);
  });
});

describe("signedUnitPrice", () => {
  it("remise négative, autres lignes positives", () => {
    expect(signedUnitPrice("DISCOUNT", 500)).toBe(-500);
    expect(signedUnitPrice("DISCOUNT", -500)).toBe(-500);
    expect(signedUnitPrice("SERVICE", -200)).toBe(200);
  });
});

describe("formatBadgeSize", () => {
  it("convertit les pixels CSS en millimètres avec virgule", () => {
    expect(formatBadgeSize(378, 254)).toMatch(/^\d+,?\d* × \d+,?\d* mm$/);
    expect(formatBadgeSize(96, 96)).toBe("25,4 × 25,4 mm");
  });
});
