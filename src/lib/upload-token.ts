import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_SECONDS = 3600;

export class UploadTokenError extends Error {
  constructor(public code: "INVALID" | "EXPIRED" | "MALFORMED", message?: string) {
    super(message ?? code);
  }
}

export type UploadTokenKind = "photo" | "document";

export type UploadTokenPayload = {
  eventId: string;
  kind: UploadTokenKind;
  storageKey: string;
  iat: number;
  exp: number;
};

function getSecret(): string {
  const s = process.env.UPLOAD_TOKEN_SECRET;
  if (!s) throw new Error("UPLOAD_TOKEN_SECRET is not defined");
  return s;
}

function b64urlEncode(b: Buffer | string): string {
  return Buffer.from(b).toString("base64url");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function signUploadToken(
  input: { eventId: string; kind: UploadTokenKind; storageKey: string },
  opts?: { issuedAt?: number; ttlSeconds?: number },
): string {
  const iat = opts?.issuedAt ?? Math.floor(Date.now() / 1000);
  const exp = iat + (opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const payload: UploadTokenPayload = { ...input, iat, exp };
  const payloadStr = b64urlEncode(JSON.stringify(payload));
  const sig = sign(payloadStr);
  return `${payloadStr}.${sig}`;
}

export function verifyUploadToken(token: string): UploadTokenPayload {
  const parts = token.split(".");
  if (parts.length !== 2) throw new UploadTokenError("MALFORMED");
  const [payloadStr, sig] = parts;
  const expected = sign(payloadStr);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UploadTokenError("INVALID");
  }
  let payload: UploadTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadStr).toString("utf8"));
  } catch {
    throw new UploadTokenError("MALFORMED");
  }
  if (
    typeof payload.eventId !== "string" ||
    (payload.kind !== "photo" && payload.kind !== "document") ||
    typeof payload.storageKey !== "string" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number"
  ) {
    throw new UploadTokenError("MALFORMED");
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new UploadTokenError("EXPIRED");
  return payload;
}
