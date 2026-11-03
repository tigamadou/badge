export const BADGE_ENVS = ["dev", "preprod", "prod"] as const;
export type BadgeEnv = (typeof BADGE_ENVS)[number];

export class BadgeEnvError extends Error {}

/** Lit BADGE_ENV (trim + minuscules). Absent ou valeur inconnue → null. */
export function readBadgeEnv(
  env: Record<string, string | undefined> = process.env,
): BadgeEnv | null {
  const value = env.BADGE_ENV?.trim().toLowerCase();
  return BADGE_ENVS.find((known) => known === value) ?? null;
}

/** Autorise le seed de démo : "dev" | "preprod", sinon lève BadgeEnvError (absent, invalide, prod). */
export function assertDemoSeedAllowed(
  env: Record<string, string | undefined> = process.env,
): "dev" | "preprod" {
  const current = readBadgeEnv(env);
  if (current === "dev" || current === "preprod") return current;
  throw new BadgeEnvError(
    `Seed de démo refusé : BADGE_ENV vaut ${JSON.stringify(env.BADGE_ENV ?? null)} (attendu "dev" ou "preprod").`,
  );
}
