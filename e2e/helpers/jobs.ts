import type { JobStatus } from "@prisma/client";
import { getDb } from "./db";

// Cree un job d'email directement en base (le worker de dev l'envoie si statut PENDING et runAt echu).
export async function createTestEmailJob(opts: {
  to: string;
  kind: string;
  status: JobStatus;
  subject: string;
  html: string;
  attempts?: number;
  lastError?: string;
  runAt?: Date;
}): Promise<{ id: string }> {
  const job = await getDb().job.create({
    data: {
      type: "EMAIL",
      kind: opts.kind,
      status: opts.status,
      recipient: opts.to,
      attempts: opts.attempts ?? 0,
      lastError: opts.lastError ?? null,
      ...(opts.runAt ? { runAt: opts.runAt } : {}),
      ...(opts.status === "FAILED" || opts.status === "CANCELLED" ? { completedAt: new Date() } : {}),
      payload: { to: opts.to, subject: opts.subject, html: opts.html, kind: opts.kind },
    },
    select: { id: true },
  });
  return job;
}

export async function cleanupTestEmailJobs(recipientPrefix: string): Promise<void> {
  await getDb().job.deleteMany({ where: { recipient: { startsWith: recipientPrefix } } });
}
