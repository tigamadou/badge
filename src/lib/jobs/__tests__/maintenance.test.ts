import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { purgeOldJobs, recoverStaleJobs } from "@/lib/jobs/maintenance";
import { createEmailJob } from "./helpers";

const now = new Date("2026-10-24T10:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;
const DAY = 24 * 3_600_000;

describe("recoverStaleJobs", () => {
  it("requeues RUNNING jobs locked more than 10 minutes ago", async () => {
    const job = await createEmailJob({
      status: "RUNNING",
      lockedAt: ago(10 * MIN + 1000),
      lockedBy: "dead",
      attempts: 2,
    });
    expect(await recoverStaleJobs(now)).toBe(1);
    const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(row).toMatchObject({ status: "PENDING", lockedAt: null, lockedBy: null, attempts: 2 });
  });

  it("keeps RUNNING jobs locked less than 10 minutes ago", async () => {
    const job = await createEmailJob({ status: "RUNNING", lockedAt: ago(9 * MIN), lockedBy: "w" });
    expect(await recoverStaleJobs(now)).toBe(0);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("RUNNING");
  });

  it("defaults now to the current time", async () => {
    expect(await recoverStaleJobs()).toBe(0);
  });
});

describe("purgeOldJobs", () => {
  it("deletes SUCCEEDED and CANCELLED jobs completed more than 30 days ago", async () => {
    await createEmailJob({ status: "SUCCEEDED", completedAt: ago(31 * DAY) });
    await createEmailJob({ status: "CANCELLED", completedAt: ago(31 * DAY) });
    expect(await purgeOldJobs(now)).toBe(2);
    expect(await prisma.job.count()).toBe(0);
  });

  it("keeps recent terminal jobs and every FAILED job", async () => {
    await createEmailJob({ status: "SUCCEEDED", completedAt: ago(29 * DAY) });
    await createEmailJob({ status: "FAILED", completedAt: null });
    await createEmailJob({ status: "PENDING" });
    expect(await purgeOldJobs(now)).toBe(0);
    expect(await prisma.job.count()).toBe(3);
  });

  it("defaults now to the current time", async () => {
    expect(await purgeOldJobs()).toBe(0);
  });
});
