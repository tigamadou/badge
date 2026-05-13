import { describe, it, expect } from "vitest";
import { formatBadgeName, formatBadgeStructure } from "../format-badge-name";

describe("formatBadgeName", () => {
  it("returns full name when within 18 characters", () => {
    expect(formatBadgeName("Jean", "Dupont")).toBe("Jean DUPONT");
  });

  it("returns full name when exactly 18 characters", () => {
    // "Mamadou DIALLO_BA" = 18 chars (not over limit, but let's test boundary)
    // "Ali KOUASSI_BARRY" = 17 chars → under limit
    expect(formatBadgeName("Ali", "Kouassi_Barry")).toBe("Ali KOUASSI_BARRY");
  });

  it("truncates firstName when full name exceeds 18 characters", () => {
    // "Jean-Baptiste KOUASSI" = 21 chars
    const result = formatBadgeName("Jean-Baptiste", "Kouassi");
    expect(result.length).toBeLessThanOrEqual(18);
    expect(result).toContain("KOUASSI");
    expect(result).toMatch(/^J.*\. KOUASSI$/);
  });

  it("always keeps lastName fully visible", () => {
    const result = formatBadgeName("Jean-Baptiste", "Kouassi");
    expect(result.endsWith("KOUASSI")).toBe(true);
  });

  it("handles very long lastName that fills all 18 characters", () => {
    // lastName alone = "ABCDEFGHIJKLMNOPQR" = 18 chars
    const result = formatBadgeName("Jean", "abcdefghijklmnopqr");
    expect(result.length).toBeLessThanOrEqual(18);
  });

  it("uppercases the lastName", () => {
    expect(formatBadgeName("Jean", "dupont")).toBe("Jean DUPONT");
  });
});

describe("formatBadgeStructure", () => {
  it("returns structure as-is when within 28 characters", () => {
    expect(formatBadgeStructure("Ministère de la Santé")).toBe("Ministère de la Santé");
  });

  it("truncates with ... when exceeding 28 characters", () => {
    const long = "Ministère de l'Enseignement Supérieur et de la Recherche";
    const result = formatBadgeStructure(long);
    expect(result.length).toBe(31); // 28 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("returns structure as-is when exactly 28 characters", () => {
    const exact = "A".repeat(28);
    expect(formatBadgeStructure(exact)).toBe(exact);
  });
});
