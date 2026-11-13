import { describe, it, expect } from "vitest";
import { systemRolePermissions } from "@/lib/permissions";
import {
  availableActions,
  canEditQuote,
  canGenerateSheets,
  formatBadgeSize,
  signedUnitPrice,
  unprintedIds,
} from "../request-actions";

const SA = systemRolePermissions("SUPER_ADMIN");
const AD = systemRolePermissions("STAFF_ADMIN");
const SU = systemRolePermissions("STAFF_SUPPORT");
const PR = systemRolePermissions("STAFF_PRINTER");
const OB = systemRolePermissions("STAFF_OBSERVER");

describe("availableActions", () => {
  it("SUBMITTED : devis et refus pour un administrateur", () => {
    expect(availableActions("SUBMITTED", "ADVANCE", AD)).toEqual(["SEND_QUOTE", "REJECT"]);
  });
  it("SUBMITTED : l'imprimeur ne peut que refuser", () => {
    expect(availableActions("SUBMITTED", "ADVANCE", PR)).toEqual(["REJECT"]);
  });
  it("l'observateur et le support n'ont aucune action", () => {
    for (const s of ["SUBMITTED", "QUOTED", "ACCEPTED", "PAID", "IN_PRODUCTION", "READY"] as const) {
      expect(availableActions(s, "ADVANCE", OB)).toEqual([]);
      expect(availableActions(s, "ADVANCE", SU)).toEqual([]);
    }
  });
  it("ACCEPTED : marquer payée et rouvrir réservés à l'administrateur", () => {
    expect(availableActions("ACCEPTED", "ADVANCE", AD)).toEqual(["MARK_PAID", "REOPEN"]);
    expect(availableActions("ACCEPTED", "ADVANCE", PR)).toEqual([]);
  });
  it("production : l'imprimeur suit la chaîne PAID -> IN_PRODUCTION -> READY -> COMPLETED en amont", () => {
    expect(availableActions("PAID", "ADVANCE", PR)).toEqual(["START_PRODUCTION"]);
    expect(availableActions("IN_PRODUCTION", "ADVANCE", PR)).toEqual(["MARK_READY"]);
    expect(availableActions("READY", "ADVANCE", PR)).toEqual(["COMPLETE"]);
  });
  it("COMPLETE sur une commande sur place exige onsite.complete : refusé à l'imprimeur", () => {
    expect(availableActions("READY", "ONSITE", PR)).toEqual([]);
    expect(availableActions("READY", "ONSITE", AD)).toEqual(["COMPLETE"]);
    expect(availableActions("IN_PRODUCTION", "ONSITE", PR)).toEqual(["MARK_READY"]);
  });
  it("états terminaux : rien", () => {
    for (const s of ["COMPLETED", "REJECTED", "CANCELLED", "DRAFT"] as const) {
      expect(availableActions(s, "ADVANCE", SA)).toEqual([]);
    }
  });
});

describe("canEditQuote", () => {
  it("quote.edit sur SUBMITTED et QUOTED seulement", () => {
    expect(canEditQuote("SUBMITTED", AD)).toBe(true);
    expect(canEditQuote("QUOTED", SA)).toBe(true);
    expect(canEditQuote("ACCEPTED", AD)).toBe(false);
    expect(canEditQuote("SUBMITTED", PR)).toBe(false);
  });
});

describe("canGenerateSheets", () => {
  it("commande en amont payée, de PAID à READY", () => {
    expect(canGenerateSheets("PAID", "ADVANCE", PR)).toBe(true);
    expect(canGenerateSheets("READY", "ADVANCE", AD)).toBe(true);
    expect(canGenerateSheets("COMPLETED", "ADVANCE", AD)).toBe(false);
    expect(canGenerateSheets("ACCEPTED", "ADVANCE", AD)).toBe(false);
    expect(canGenerateSheets("PAID", "ONSITE", AD)).toBe(false);
    expect(canGenerateSheets("PAID", "ADVANCE", OB)).toBe(false);
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
