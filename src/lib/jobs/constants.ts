// Delais avant nouvel essai apres le 1er, 2e, 3e et 4e echec ; le 5e echec est definitif.
export const RETRY_DELAYS_MS: readonly number[] = [60_000, 300_000, 1_800_000, 7_200_000];
// Un job RUNNING verrouille depuis plus longtemps est considere orphelin (worker mort).
export const STALE_LOCK_MS = 600_000;
export const RETENTION_MS = 30 * 24 * 3_600_000;
export const PURGE_INTERVAL_MS = 3_600_000;
// Passe horaire des abonnements : échéances, rappels, paiements orphelins.
export const SUBSCRIPTION_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
export const REMINDER_DAYS = [7, 1] as const;
// Doit rester nettement sous STALE_LOCK_MS : sinon un envoi bloque serait recupere puis duplique.
export const SEND_TIMEOUT_MS = 120_000;
export const LAST_ERROR_MAX_LENGTH = 2000;
export const DEFAULT_POLL_INTERVAL_MS = 2000;
export const DEFAULT_EMAIL_CONCURRENCY = 5;
export const EMAIL_PRIORITY_VALUE: Record<"high" | "normal", number> = { high: 10, normal: 0 };

// attempts = nombre de tentatives APRES l'echec courant (1 pour le premier echec).
export function computeRetryDelayMs(attempts: number): number {
  const index = Math.min(Math.max(attempts, 1), RETRY_DELAYS_MS.length) - 1;
  return RETRY_DELAYS_MS[index];
}

// Planches d'impression : un battement est ecrit apres chaque badge rendu ; une generation
// RUNNING sans battement depuis ce delai est reprise (worker mort), au plus MAX_ATTEMPTS fois.
export const PRINT_SHEETS_STALE_MS = 180_000;
export const PRINT_SHEETS_MAX_ATTEMPTS = 3;
