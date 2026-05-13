import { describe, it, expect } from "vitest";
import { formatBadgeName, formatBadgeStructure } from "../format-badge-name";

describe("formatBadgeName", () => {
  it("returns full name when within 20 characters", () => {
    expect(formatBadgeName("Jean", "Dupont")).toBe("Jean DUPONT");
  });

  it("uppercases the lastName", () => {
    expect(formatBadgeName("Jean", "dupont")).toBe("Jean DUPONT");
  });

  it("shortens rightmost first names first", () => {
    // "Jean François Alain DUPOND" = 26 chars > 20
    // Step 1: "Jean François A. DUPOND" = 23 > 20
    // Step 2: "Jean F. A. DUPOND" = 17 <= 20 ✓
    expect(formatBadgeName("Jean François Alain", "Dupond")).toBe("Jean F. A. DUPOND");
  });

  it("shortens only as many names as needed", () => {
    // "Marie Claire DUVAL" = 18 <= 20 → no shortening
    expect(formatBadgeName("Marie Claire", "Duval")).toBe("Marie Claire DUVAL");
  });

  it("shortens all first names if needed", () => {
    // "Jean François Alain KOUASSI-BARRY" = 33 > 20
    // All shortened: "J. F. A. KOUASSI-BARRY" = 22 > 20 (best effort)
    const result = formatBadgeName("Jean François Alain", "Kouassi-Barry");
    expect(result).toContain("KOUASSI-BARRY");
    expect(result).toBe("J. F. A. KOUASSI-BARRY");
  });

  it("handles single firstName that fits", () => {
    expect(formatBadgeName("Ali", "Ba")).toBe("Ali BA");
  });

  it("shortens single firstName when too long", () => {
    // "Jean-Baptiste KOUASSI-DIALLO" = 28 > 20
    // Shortened: "J. KOUASSI-DIALLO" = 17 <= 20 ✓
    expect(formatBadgeName("Jean-Baptiste", "Kouassi-Diallo")).toBe("J. KOUASSI-DIALLO");
  });

  it("always keeps lastName fully visible", () => {
    const result = formatBadgeName("Jean François Alain", "Dupond");
    expect(result.endsWith("DUPOND")).toBe(true);
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
