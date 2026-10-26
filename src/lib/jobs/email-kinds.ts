import { EMAIL_KIND } from "./enqueue-email";

// Emails dont le HTML contient un lien a jeton : jamais affiches ni renvoyes par l'API.
export const SENSITIVE_EMAIL_KINDS: readonly string[] = [
  EMAIL_KIND.ACCOUNT_VERIFY_EMAIL,
  EMAIL_KIND.ACCOUNT_PASSWORD_RESET,
  EMAIL_KIND.USER_PASSWORD_RESET,
  EMAIL_KIND.USER_INVITATION,
];

export function isSensitiveEmailKind(kind: string): boolean {
  return SENSITIVE_EMAIL_KINDS.includes(kind);
}
