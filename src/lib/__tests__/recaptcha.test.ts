import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyRecaptcha } from "@/lib/recaptcha";

const originalFetch = global.fetch;

describe("verifyRecaptcha", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns ok=true when disabled (no secret)", async () => {
    const r = await verifyRecaptcha({ enabled: false, secretKey: "", token: "anything" });
    expect(r.ok).toBe(true);
  });

  it("returns ok=false when enabled and token is missing", async () => {
    const r = await verifyRecaptcha({ enabled: true, secretKey: "s", token: "" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected verification to fail");
    expect(r.code).toBe("MISSING_TOKEN");
  });

  it("calls Google and returns ok=true on score >= 0.5", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ success: true, score: 0.7 }),
    });
    const r = await verifyRecaptcha({ enabled: true, secretKey: "s", token: "t" });
    expect(r.ok).toBe(true);
  });

  it("returns ok=false when score < 0.5", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ success: true, score: 0.3 }),
    });
    const r = await verifyRecaptcha({ enabled: true, secretKey: "s", token: "t" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected verification to fail");
    expect(r.code).toBe("LOW_SCORE");
  });

  it("returns ok=false when google says success=false", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
    });
    const r = await verifyRecaptcha({ enabled: true, secretKey: "s", token: "t" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected verification to fail");
    expect(r.code).toBe("REJECTED");
  });
});
