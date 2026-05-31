import { describe, it, expect, beforeAll } from "vitest";
import {
  signUploadToken,
  verifyUploadToken,
  UploadTokenError,
} from "@/lib/upload-token";

beforeAll(() => {
  process.env.UPLOAD_TOKEN_SECRET = "test-secret";
});

describe("upload-token", () => {
  it("round-trips a valid payload", () => {
    const token = signUploadToken({
      eventId: "evt1",
      kind: "photo",
      storageKey: "events/evt1/photos/a.jpg",
    });
    const payload = verifyUploadToken(token);
    expect(payload.eventId).toBe("evt1");
    expect(payload.kind).toBe("photo");
    expect(payload.storageKey).toBe("events/evt1/photos/a.jpg");
  });

  it("rejects a token with a tampered payload", () => {
    const token = signUploadToken({
      eventId: "evt1",
      kind: "photo",
      storageKey: "events/evt1/photos/a.jpg",
    });
    const [pay, sig] = token.split(".");
    // mutate the payload but keep the signature
    const mutated = Buffer.from(pay, "base64url").toString("utf8").replace("evt1", "evt2");
    const newPay = Buffer.from(mutated).toString("base64url");
    expect(() => verifyUploadToken(`${newPay}.${sig}`)).toThrow(UploadTokenError);
  });

  it("rejects an expired token", () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    const token = signUploadToken(
      { eventId: "evt1", kind: "photo", storageKey: "k" },
      { issuedAt: past, ttlSeconds: 5 },
    );
    expect(() => verifyUploadToken(token)).toThrow(/EXPIRED/);
  });

  it("rejects a malformed token (no dot)", () => {
    expect(() => verifyUploadToken("nonsense")).toThrow(UploadTokenError);
  });

  it("default TTL is 3600 seconds", () => {
    const token = signUploadToken({
      eventId: "evt1",
      kind: "document",
      storageKey: "events/evt1/idDocuments/x.pdf",
    });
    const payload = verifyUploadToken(token);
    expect(payload.exp - payload.iat).toBe(3600);
  });

  it("rejects a token signed over a payload missing required fields", async () => {
    const { createHmac } = await import("crypto");
    const payloadStr = Buffer.from("{}").toString("base64url");
    const sig = createHmac("sha256", "test-secret").update(payloadStr).digest("base64url");
    expect(() => verifyUploadToken(`${payloadStr}.${sig}`)).toThrow(/MALFORMED/);
  });
});
