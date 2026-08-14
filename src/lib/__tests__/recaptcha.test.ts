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

  it("returns ok=true (no score) when google omits the score", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });
    const r = await verifyRecaptcha({ enabled: true, secretKey: "s", token: "t" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected verification to pass");
    expect(r.score).toBeUndefined();
  });

  it("passes remoteip to Google when remoteIp is provided", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: true, score: 0.9 }) });
    const r = await verifyRecaptcha({
      enabled: true,
      secretKey: "s",
      token: "t",
      remoteIp: "203.0.113.5",
    });
    expect(r.ok).toBe(true);
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("remoteip")).toBe("203.0.113.5");
    expect(body.get("secret")).toBe("s");
    expect(body.get("response")).toBe("t");
  });

  it("returns NETWORK when the request throws", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("boom"));
    const r = await verifyRecaptcha({ enabled: true, secretKey: "s", token: "t" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected verification to fail");
    expect(r.code).toBe("NETWORK");
    expect(r.details).toContain("boom");
  });
});
