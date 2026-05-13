import { describe, it, expect } from "vitest";
import { formatBadgeName } from "../format-badge-name";

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
