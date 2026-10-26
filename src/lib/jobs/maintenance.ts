import { prisma } from "@/lib/prisma";
import { RETENTION_MS, STALE_LOCK_MS } from "./constants";

// Remet en PENDING les jobs RUNNING dont le worker est mort (verrou trop ancien).
export async function recoverStaleJobs(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.job.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: new Date(now.getTime() - STALE_LOCK_MS) } },
    data: { status: "PENDING", lockedAt: null, lockedBy: null },
  });
  return count;
}

// Supprime les jobs termines (SUCCEEDED, CANCELLED) depuis plus de 30 jours ; les FAILED restent.
export async function purgeOldJobs(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.job.deleteMany({
    where: {
      status: { in: ["SUCCEEDED", "CANCELLED"] },
      completedAt: { lt: new Date(now.getTime() - RETENTION_MS) },
    },
  });
  return count;
}
