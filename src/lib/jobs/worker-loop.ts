import { PURGE_INTERVAL_MS, SUBSCRIPTION_SWEEP_INTERVAL_MS } from "./constants";
import type { WorkerConfig } from "./config";
import { purgeOldJobs, recoverStaleJobs } from "./maintenance";
import { processBatch, type BatchSummary } from "./process-batch";
import { runSubscriptionSweep } from "./subscription-sweep";
import { purgeReadNotifications } from "@/lib/notifications/retention";
import {
  claimGeneration,
  recoverStaleGenerations,
  runGeneration,
} from "@/lib/print-sheets/run-generation";

export type WorkerLog = (message: string, meta?: Record<string, unknown>) => void;
export type WorkerDeps = {
  processBatch: typeof processBatch;
  recoverStaleJobs: typeof recoverStaleJobs;
  purgeOldJobs: typeof purgeOldJobs;
  purgeReadNotifications: typeof purgeReadNotifications;
  runSubscriptionSweep: typeof runSubscriptionSweep;
  printSheets: {
    claim: typeof claimGeneration;
    run: typeof runGeneration;
    recover: typeof recoverStaleGenerations;
  };
};

export function createWorkerLoop(opts: {
  workerId: string;
  config: WorkerConfig;
  log?: WorkerLog;
  deps?: Partial<WorkerDeps>;
}) {
  const { workerId, config } = opts;
  const log: WorkerLog = opts.log ?? (() => {});
  const deps: WorkerDeps = {
    processBatch,
    recoverStaleJobs,
    purgeOldJobs,
    purgeReadNotifications,
    runSubscriptionSweep,
    printSheets: { claim: claimGeneration, run: runGeneration, recover: recoverStaleGenerations },
    ...opts.deps,
  };

  let stopping = false;
  let lastPurgeAt: number | null = null;
  let lastSweepAt: number | null = null;
  let current: Promise<unknown> = Promise.resolve();
  let wake: (() => void) | null = null;
  // Generation d'impression en cours dans ce worker : une seule a la fois, jamais attendue.
  let generation: Promise<unknown> | null = null;

  // Un journal defaillant ne doit jamais faire echouer une generation ni l'envoi des emails.
  function safeLog(message: string, meta?: Record<string, unknown>): void {
    try {
      log(message, meta);
    } catch {
      // ignore
    }
  }

  // Reprise des orphelines, puis lancement (sans attente) d'une generation si le worker est libre.
  // Une erreur ici ne doit jamais bloquer l'envoi des emails.
  async function dispatchGeneration(now: Date): Promise<void> {
    try {
      const recovered = await deps.printSheets.recover(now);
      if (recovered > 0) safeLog("[worker] recovered stale print generations", { recovered });
      if (generation) return;
      const claimed = await deps.printSheets.claim({ workerId, now });
      if (!claimed) return;
      safeLog("[worker] print generation started", { id: claimed.id });
      const promise: Promise<unknown> = deps.printSheets
        .run(claimed.id, workerId)
        .then((outcome) => safeLog("[worker] print generation finished", { id: claimed.id, outcome }))
        .catch((err) =>
          safeLog("[worker] print generation crashed", {
            id: claimed.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
        .catch(() => {})
        .finally(() => {
          generation = null;
        });
      generation = promise;
    } catch (err) {
      safeLog("[worker] print generation dispatch failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function runOnce(now: Date = new Date()): Promise<BatchSummary> {
    const recovered = await deps.recoverStaleJobs(now);
    if (recovered > 0) log("[worker] recovered stale jobs", { recovered });
    if (lastPurgeAt === null || now.getTime() - lastPurgeAt >= PURGE_INTERVAL_MS) {
      lastPurgeAt = now.getTime();
      const purged = await deps.purgeOldJobs(now);
      if (purged > 0) log("[worker] purged old jobs", { purged });
      const purgedNotifications = await deps.purgeReadNotifications(now);
      if (purgedNotifications > 0) {
        log("[worker] purged read notifications", { purged: purgedNotifications });
      }
    }
    if (lastSweepAt === null || now.getTime() - lastSweepAt >= SUBSCRIPTION_SWEEP_INTERVAL_MS) {
      lastSweepAt = now.getTime();
      const sweep = await deps.runSubscriptionSweep(now);
      if (sweep.settled + sweep.reminded + sweep.reconciled + sweep.expired > 0) {
        log("[worker] subscription sweep", { ...sweep });
      }
    }
    await dispatchGeneration(now);
    return deps.processBatch({ workerId, limit: config.emailConcurrency, now });
  }

  // Attente interruptible par stop().
  function idle(): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        wake = null;
        resolve();
      }, config.pollIntervalMs);
      wake = () => {
        clearTimeout(timer);
        wake = null;
        resolve();
      };
    });
  }

  async function tick(): Promise<void> {
    try {
      const summary = await runOnce();
      if (summary.claimed > 0) log("[worker] batch", { ...summary });
    } catch (err) {
      log("[worker] tick failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function start(): Promise<void> {
    while (!stopping) {
      current = tick();
      await current;
      if (!stopping) await idle();
    }
  }

  async function stop(): Promise<void> {
    stopping = true;
    wake?.();
    await current;
  }

  return { runOnce, start, stop };
}
