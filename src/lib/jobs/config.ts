import { DEFAULT_EMAIL_CONCURRENCY, DEFAULT_POLL_INTERVAL_MS } from "./constants";

export type WorkerConfig = { pollIntervalMs: number; emailConcurrency: number };

// Entier strictement positif, sinon la valeur par defaut.
function positiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || !/^\d+$/.test(raw)) return fallback;
  const n = Number(raw);
  return n > 0 ? n : fallback;
}

export function readWorkerConfig(env: Record<string, string | undefined>): WorkerConfig {
  return {
    pollIntervalMs: positiveInt(env.JOB_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS),
    emailConcurrency: positiveInt(env.JOB_EMAIL_CONCURRENCY, DEFAULT_EMAIL_CONCURRENCY),
  };
}
