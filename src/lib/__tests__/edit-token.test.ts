import { describe, it, expect } from "vitest";
import { generateEditToken, isEditTokenExpired, EDIT_TOKEN_TTL_MS } from "@/lib/edit-token";

describe("generateEditToken", () => {
  it("returns 64 hex chars (32 bytes)", () => {
    const t = generateEditToken();
    expect(t.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns expiresAt 48h in the future", () => {
    const now = Date.now();
    const t = generateEditToken();
    const diff = t.expiresAt.getTime() - now;
    expect(diff).toBeGreaterThanOrEqual(EDIT_TOKEN_TTL_MS - 1000);
    expect(diff).toBeLessThanOrEqual(EDIT_TOKEN_TTL_MS + 1000);
  });

  it("generates a fresh token each call", () => {
    const a = generateEditToken();
    const b = generateEditToken();
    expect(a.token).not.toBe(b.token);
  });
});

describe("isEditTokenExpired", () => {
  it("returns true when expiresAt is null", () => {
    expect(isEditTokenExpired(null)).toBe(true);
  });

  it("returns true when expiresAt is in the past", () => {
    expect(isEditTokenExpired(new Date(Date.now() - 1000))).toBe(true);
  });

  it("returns false when expiresAt is in the future", () => {
    expect(isEditTokenExpired(new Date(Date.now() + 1000))).toBe(false);
  });
});
