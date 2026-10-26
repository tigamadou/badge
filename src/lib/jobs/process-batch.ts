import type { Job, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LAST_ERROR_MAX_LENGTH, computeRetryDelayMs } from "./constants";
import { parseEmailPayload } from "./email-payload";
import { sendEmailPayload } from "./send-email";
import { notifyEmailFailed } from "@/lib/notifications/triggers";

export type BatchSummary = {
  claimed: number;
  succeeded: number;
  retried: number;
  failed: number;
  lockLost: number;
};

type Outcome = "succeeded" | "retried" | "failed" | "lockLost";

// Reserve des jobs EMAIL dus : SKIP LOCKED evite qu'un autre worker prenne les memes lignes.
export async function claimEmailJobs(opts: {
  workerId: string;
  limit: number;
  now: Date;
}): Promise<Job[]> {
  const { workerId, limit, now } = opts;
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM \`Job\`
      WHERE type = 'EMAIL' AND status = 'PENDING' AND runAt <= ${now}
      ORDER BY priority DESC, runAt ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED`;
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    await tx.job.updateMany({
      where: { id: { in: ids } },
      data: { status: "RUNNING", lockedAt: now, lockedBy: workerId },
    });
    const jobs = await tx.job.findMany({ where: { id: { in: ids } } });
    return ids.map((id) => jobs.find((j) => j.id === id)!);
  });
}

// Toute mise a jour est conditionnee au verrou : si un autre worker a repris le job
// (orphelin recupere), on ne touche a rien.
async function updateIfLocked(
  job: Job,
  workerId: string,
  data: Prisma.JobUpdateManyMutationInput,
): Promise<boolean> {
  const { count } = await prisma.job.updateMany({
    where: { id: job.id, status: "RUNNING", lockedBy: workerId },
    data,
  });
  if (count === 0) {
    console.log("[worker] lock lost", { jobId: job.id, workerId });
    return false;
  }
  return true;
}

// Point unique de passage en FAILED : le staff plateforme est notifie (EMAIL_FAILED, spec 24).
async function failJob(
  job: Job,
  workerId: string,
  attempts: number,
  lastError: string,
): Promise<Outcome> {
  const ok = await updateIfLocked(job, workerId, {
    status: "FAILED",
    attempts,
    lastError,
    lockedAt: null,
    lockedBy: null,
  });
  if (!ok) return "lockLost";
  await notifyEmailFailed({ id: job.id, kind: job.kind, recipient: job.recipient, attempts });
  return "failed";
}

async function completeJob(job: Job, workerId: string, now: Date): Promise<Outcome> {
  const ok = await updateIfLocked(job, workerId, {
    status: "SUCCEEDED",
    completedAt: now,
    payload: { ...(job.payload as Prisma.JsonObject), html: "" },
    lockedAt: null,
    lockedBy: null,
  });
  return ok ? "succeeded" : "lockLost";
}

async function retryOrFail(
  job: Job,
  workerId: string,
  now: Date,
  err: unknown,
): Promise<Outcome> {
  const attempts = job.attempts + 1;
  const lastError = (err instanceof Error ? err.message : String(err)).slice(
    0,
    LAST_ERROR_MAX_LENGTH,
  );
  if (attempts >= job.maxAttempts) return failJob(job, workerId, attempts, lastError);
  const ok = await updateIfLocked(job, workerId, {
    status: "PENDING",
    attempts,
    lastError,
    runAt: new Date(now.getTime() + computeRetryDelayMs(attempts)),
    lockedAt: null,
    lockedBy: null,
  });
  return ok ? "retried" : "lockLost";
}

async function processJob(
  job: Job,
  workerId: string,
  now: Date,
  sendTimeoutMs?: number,
): Promise<Outcome> {
  const payload = parseEmailPayload(job.payload);
  if (!payload) return failJob(job, workerId, job.attempts + 1, "INVALID_PAYLOAD");
  try {
    await sendEmailPayload(payload, { timeoutMs: sendTimeoutMs });
  } catch (err) {
    return retryOrFail(job, workerId, now, err);
  }
  return completeJob(job, workerId, now);
}

export async function processBatch(opts: {
  workerId: string;
  limit: number;
  now?: Date;
  sendTimeoutMs?: number;
}): Promise<BatchSummary> {
  const now = opts.now ?? new Date();
  const jobs = await claimEmailJobs({ workerId: opts.workerId, limit: opts.limit, now });
  const summary: BatchSummary = {
    claimed: jobs.length,
    succeeded: 0,
    retried: 0,
    failed: 0,
    lockLost: 0,
  };
  const results = await Promise.allSettled(
    jobs.map((job) => processJob(job, opts.workerId, now, opts.sendTimeoutMs)),
  );
  for (const r of results) {
    if (r.status === "fulfilled") summary[r.value] += 1;
    else console.error("[worker] job crashed", r.reason);
  }
  return summary;
}
