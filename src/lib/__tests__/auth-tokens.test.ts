import { describe, it, expect } from "vitest";
import {
  generateToken,
  hashToken,
  computeExpiry,
  isExpired,
  EMAIL_VERIFY_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/auth-tokens";

describe("auth-tokens", () => {
  describe("generateToken", () => {
    it("returns a string of at least 40 characters", () => {
      const t = generateToken();
      expect(typeof t).toBe("string");
      expect(t.length).toBeGreaterThanOrEqual(40);
    });

    it("returns a different token on each call", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 20; i++) {
        tokens.add(generateToken());
      }
      expect(tokens.size).toBe(20);
    });
  });

  describe("hashToken", () => {
    it("is deterministic for the same token", () => {
      const t = "some-token-value";
      expect(hashToken(t)).toBe(hashToken(t));
    });

    it("differs from the input token", () => {
      const t = generateToken();
      expect(hashToken(t)).not.toBe(t);
    });

    it("produces different hashes for different tokens", () => {
      expect(hashToken("a")).not.toBe(hashToken("b"));
    });
  });

  describe("computeExpiry", () => {
    it("adds the TTL to the current time", () => {
      const before = Date.now();
      const exp = computeExpiry(60_000);
      const after = Date.now();
      expect(exp.getTime()).toBeGreaterThanOrEqual(before + 60_000);
      expect(exp.getTime()).toBeLessThanOrEqual(after + 60_000);
    });
  });

  describe("TTL constants", () => {
    it("EMAIL_VERIFY_TTL_MS = 24 hours", () => {
      expect(EMAIL_VERIFY_TTL_MS).toBe(24 * 60 * 60 * 1000);
    });

    it("PASSWORD_RESET_TTL_MS = 1 hour", () => {
      expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000);
    });
  });

  describe("isExpired", () => {
    it("returns true for a past date", () => {
      expect(isExpired(new Date(Date.now() - 1000))).toBe(true);
    });

    it("returns false for a future date", () => {
      expect(isExpired(new Date(Date.now() + 60_000))).toBe(false);
    });

    it("returns true for null", () => {
      expect(isExpired(null)).toBe(true);
    });

    it("returns true for undefined", () => {
      expect(isExpired(undefined)).toBe(true);
    });
  });
});
