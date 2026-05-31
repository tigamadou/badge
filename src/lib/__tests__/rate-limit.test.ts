import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  extractClientIp,
  resetRateLimitForTests,
  DEFAULT_WINDOW_MS,
  DEFAULT_MAX,
} from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitForTests();
    vi.useFakeTimers();
  });

  it("allows up to N requests in the window", () => {
    for (let i = 0; i < DEFAULT_MAX; i++) {
      expect(checkRateLimit("1.1.1.1", "route-a").ok).toBe(true);
    }
    expect(checkRateLimit("1.1.1.1", "route-a").ok).toBe(false);
  });

  it("isolates by IP", () => {
    for (let i = 0; i < DEFAULT_MAX; i++) checkRateLimit("a", "r");
    expect(checkRateLimit("b", "r").ok).toBe(true);
  });

  it("isolates by route", () => {
    for (let i = 0; i < DEFAULT_MAX; i++) checkRateLimit("a", "r1");
    expect(checkRateLimit("a", "r2").ok).toBe(true);
  });

  it("resets after the window elapses", () => {
    for (let i = 0; i < DEFAULT_MAX; i++) checkRateLimit("a", "r");
    expect(checkRateLimit("a", "r").ok).toBe(false);
    vi.advanceTimersByTime(DEFAULT_WINDOW_MS + 1);
    expect(checkRateLimit("a", "r").ok).toBe(true);
  });

  it("returns retryAfterMs in the failure result", () => {
    for (let i = 0; i < DEFAULT_MAX; i++) checkRateLimit("a", "r");
    const r = checkRateLimit("a", "r");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected rate limit to be exceeded");
    expect(r.retryAfterMs).toBeGreaterThan(0);
    expect(r.retryAfterMs).toBeLessThanOrEqual(DEFAULT_WINDOW_MS);
  });
});

describe("extractClientIp", () => {
  it("returns the first IP from x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5" });
    expect(extractClientIp(h)).toBe("203.0.113.5");
  });

  it("returns the leftmost IP when x-forwarded-for is a chain", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" });
    expect(extractClientIp(h)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const h = new Headers({ "x-real-ip": "198.51.100.42" });
    expect(extractClientIp(h)).toBe("198.51.100.42");
  });

  it("returns 0.0.0.0 when neither header is set", () => {
    const h = new Headers();
    expect(extractClientIp(h)).toBe("0.0.0.0");
  });
});
