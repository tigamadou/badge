import { randomBytes } from "crypto";

export const EDIT_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

export function generateEditToken(): { token: string; expiresAt: Date } {
  return {
    token: randomBytes(32).toString("hex"),
    expiresAt: new Date(Date.now() + EDIT_TOKEN_TTL_MS),
  };
}

export function isEditTokenExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= Date.now();
}
