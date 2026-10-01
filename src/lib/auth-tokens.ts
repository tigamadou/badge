import { randomBytes, createHash } from "node:crypto";

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

// Token aleatoire urlsafe (32 bytes -> ~43 chars base64url).
// Le token est envoye en clair dans le mail/URL ; on stocke uniquement son hash en BDD.
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function computeExpiry(ttlMs: number): Date {
  return new Date(Date.now() + ttlMs);
}

export function isExpired(expiry: Date | null | undefined): boolean {
  if (!expiry) return true;
  return expiry.getTime() < Date.now();
}
