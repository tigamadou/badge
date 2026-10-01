import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "crypto";
import {
  signUploadToken,
  verifyUploadToken,
  UploadTokenError,
} from "@/lib/upload-token";

beforeAll(() => {
  process.env.UPLOAD_TOKEN_SECRET = "test-secret";
});

// Signe un payload arbitraire avec le secret de test pour franchir la verification
// de signature et atteindre la validation de forme du payload.
function signRawPayload(obj: unknown): string {
  const payloadStr = Buffer.from(JSON.stringify(obj)).toString("base64url");
  const sig = createHmac("sha256", "test-secret").update(payloadStr).digest("base64url");
  return `${payloadStr}.${sig}`;
}

const FAR_FUTURE = Math.floor(Date.now() / 1000) + 100000;

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

  it("rejects MALFORMED when the signed payload is not valid JSON", async () => {
    // Signature valide mais le payload decode n'est pas du JSON => catch l.62-65.
    const { createHmac } = await import("crypto");
    const payloadStr = Buffer.from("this-is-not-json").toString("base64url");
    const sig = createHmac("sha256", "test-secret").update(payloadStr).digest("base64url");
    expect(() => verifyUploadToken(`${payloadStr}.${sig}`)).toThrow(/MALFORMED/);
  });

  it("rejects with an invalid signature when the secret differs", () => {
    const token = signUploadToken({ eventId: "evt1", kind: "photo", storageKey: "k" });
    const original = process.env.UPLOAD_TOKEN_SECRET;
    process.env.UPLOAD_TOKEN_SECRET = "another-secret";
    try {
      expect(() => verifyUploadToken(token)).toThrow(/INVALID/);
    } finally {
      process.env.UPLOAD_TOKEN_SECRET = original;
    }
  });

  it("throws when UPLOAD_TOKEN_SECRET is not defined", () => {
    const original = process.env.UPLOAD_TOKEN_SECRET;
    delete process.env.UPLOAD_TOKEN_SECRET;
    try {
      expect(() =>
        signUploadToken({ eventId: "evt1", kind: "photo", storageKey: "k" }),
      ).toThrow("UPLOAD_TOKEN_SECRET is not defined");
    } finally {
      process.env.UPLOAD_TOKEN_SECRET = original;
    }
  });

  it("rejects INVALID when the signature length differs (short-circuits timingSafeEqual)", () => {
    const [pay] = signUploadToken({ eventId: "evt1", kind: "photo", storageKey: "k" }).split(".");
    expect(() => verifyUploadToken(`${pay}.short`)).toThrow(/INVALID/);
  });

  it("accepts a document kind (kind branch: not photo but document)", () => {
    const token = signRawPayload({
      eventId: "e",
      kind: "document",
      storageKey: "k",
      iat: 1,
      exp: FAR_FUTURE,
    });
    expect(verifyUploadToken(token).kind).toBe("document");
  });

  it("rejects MALFORMED when kind is neither photo nor document", () => {
    const token = signRawPayload({
      eventId: "e",
      kind: "video",
      storageKey: "k",
      iat: 1,
      exp: FAR_FUTURE,
    });
    expect(() => verifyUploadToken(token)).toThrow(/MALFORMED/);
  });

  it("rejects MALFORMED when storageKey is not a string", () => {
    const token = signRawPayload({
      eventId: "e",
      kind: "photo",
      storageKey: 123,
      iat: 1,
      exp: FAR_FUTURE,
    });
    expect(() => verifyUploadToken(token)).toThrow(/MALFORMED/);
  });

  it("rejects MALFORMED when iat is not a number", () => {
    const token = signRawPayload({
      eventId: "e",
      kind: "photo",
      storageKey: "k",
      iat: "1",
      exp: FAR_FUTURE,
    });
    expect(() => verifyUploadToken(token)).toThrow(/MALFORMED/);
  });

  it("rejects MALFORMED when exp is not a number", () => {
    const token = signRawPayload({
      eventId: "e",
      kind: "photo",
      storageKey: "k",
      iat: 1,
      exp: "later",
    });
    expect(() => verifyUploadToken(token)).toThrow(/MALFORMED/);
  });
});
