import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { __mailTesting } from "@/lib/mail";
import { claimEmailJobs, processBatch } from "@/lib/jobs/process-batch";
import { createEmailJob, fakeTransport } from "./helpers";

const now = new Date("2026-10-24T10:00:00.000Z");
const at = (ms: number) => new Date(now.getTime() + ms);
let transport: ReturnType<typeof fakeTransport>;

function useTransport(opts?: Parameters<typeof fakeTransport>[0]) {
  transport = fakeTransport(opts);
  transport.install();
  return transport;
}

beforeEach(() => {
  useTransport();
});
afterEach(() => __mailTesting.reset());

describe("claimEmailJobs", () => {
  it("claims only PENDING jobs whose runAt is due", async () => {
    const due = await createEmailJob({ runAt: at(-1000) });
    await createEmailJob({ runAt: at(60_000) });
    await createEmailJob({ status: "RUNNING" });
    await createEmailJob({ status: "FAILED" });
    const claimed = await claimEmailJobs({ workerId: "w1", limit: 10, now });
    expect(claimed.map((j) => j.id)).toEqual([due.id]);
    const row = await prisma.job.findUniqueOrThrow({ where: { id: due.id } });
    expect(row.status).toBe("RUNNING");
    expect(row.lockedBy).toBe("w1");
    expect(row.lockedAt).toEqual(now);
  });

  it("orders by priority DESC then runAt ASC and respects the limit", async () => {
    const oldP0 = await createEmailJob({ priority: 0, runAt: at(-5000) });
    const newP10 = await createEmailJob({ priority: 10, runAt: at(-1000) });
    await createEmailJob({ priority: 0, runAt: at(-1000) });
    const claimed = await claimEmailJobs({ workerId: "w1", limit: 2, now });
    expect(claimed.map((j) => j.id)).toEqual([newP10.id, oldP0.id]);
  });
});

describe("processBatch", () => {
  it("marks a sent job SUCCEEDED and purges its html", async () => {
    const job = await createEmailJob({ runAt: at(-1000) });
    const summary = await processBatch({ workerId: "w1", limit: 5, now });
    expect(summary).toEqual({ claimed: 1, succeeded: 1, retried: 0, failed: 0, lockLost: 0 });
    const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(row).toMatchObject({
      status: "SUCCEEDED",
      completedAt: now,
      lockedAt: null,
      lockedBy: null,
      payload: { to: "dest@x.test", subject: "Sujet", kind: "registration.approved", html: "" },
    });
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].html).toBe("<p>Bonjour</p>");
  });

  it("schedules a retry with the backoff on failure", async () => {
    useTransport({ fail: new Error("SMTP down") });
    const job = await createEmailJob({ runAt: at(-1000) });
    const summary = await processBatch({ workerId: "w1", limit: 5, now });
    expect(summary.retried).toBe(1);
    const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.status).toBe("PENDING");
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe("SMTP down");
    expect(row.runAt.getTime()).toBe(now.getTime() + 60_000);
    expect(row.lockedBy).toBeNull();
    expect((row.payload as { html: string }).html).toBe("<p>Bonjour</p>");
  });

  it("uses the 4th delay on the 4th failure and FAILED on the 5th", async () => {
    useTransport({ fail: new Error("SMTP down") });
    const fourth = await createEmailJob({ attempts: 3, runAt: at(-1000) });
    const fifth = await createEmailJob({ attempts: 4, runAt: at(-1000) });
    const summary = await processBatch({ workerId: "w1", limit: 5, now });
    expect(summary).toMatchObject({ retried: 1, failed: 1 });
    const r4 = await prisma.job.findUniqueOrThrow({ where: { id: fourth.id } });
    expect(r4.status).toBe("PENDING");
    expect(r4.runAt.getTime()).toBe(now.getTime() + 7_200_000);
    const r5 = await prisma.job.findUniqueOrThrow({ where: { id: fifth.id } });
    expect(r5).toMatchObject({ status: "FAILED", attempts: 5, completedAt: null });
    expect((r5.payload as { html: string }).html).toBe("<p>Bonjour</p>");
  });

  it("un job qui passe FAILED notifie le staff STAFF_ADMIN (EMAIL_FAILED) sans créer de job email", async () => {
    useTransport({ fail: new Error("SMTP down") });
    const admin = await prisma.user.create({
      data: { email: "admin-ef@x.test", password: "x", name: "Admin", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await prisma.user.create({
      data: { email: "support-ef@x.test", password: "x", name: "Support", isStaff: true, staffRole: "STAFF_SUPPORT" },
    });
    const job = await createEmailJob({ attempts: 4, runAt: at(-1000), to: "dest-ef@x.test" });
    await processBatch({ workerId: "w1", limit: 5, now });
    const rows = await prisma.notification.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: admin.id,
      type: "EMAIL_FAILED",
      scope: "PLATFORM",
      href: `/platform/jobs/${job.id}`,
    });
    expect(rows[0].body).toContain("dest-ef@x.test");
    expect(await prisma.job.count()).toBe(1);
  });

  it("un job qui sera réessayé ne notifie pas le staff", async () => {
    useTransport({ fail: new Error("SMTP down") });
    await prisma.user.create({
      data: { email: "admin-ef2@x.test", password: "x", name: "Admin", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await createEmailJob({ runAt: at(-1000) });
    await processBatch({ workerId: "w1", limit: 5, now });
    expect(await prisma.notification.count()).toBe(0);
  });

  it("truncates lastError to LAST_ERROR_MAX_LENGTH", async () => {
    useTransport({ fail: new Error("x".repeat(5000)) });
    const job = await createEmailJob({ runAt: at(-1000) });
    await processBatch({ workerId: "w1", limit: 5, now });
    const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.lastError).toHaveLength(2000);
  });

  it("stringifies a non-Error rejection", async () => {
    useTransport({ onSend: async () => Promise.reject("boom-string") });
    const job = await createEmailJob({ runAt: at(-1000) });
    await processBatch({ workerId: "w1", limit: 5, now });
    const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.lastError).toBe("boom-string");
  });

  it("counts a SMTP timeout as an ordinary failure", async () => {
    useTransport({ hang: true });
    const job = await createEmailJob({ runAt: at(-1000) });
    await processBatch({ workerId: "w1", limit: 5, now, sendTimeoutMs: 20 });
    const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.status).toBe("PENDING");
    expect(row.lastError).toContain("SEND_TIMEOUT");
  });

  it("fails an invalid payload immediately without calling SMTP", async () => {
    const job = await prisma.job.create({
      data: { type: "EMAIL", kind: "k", payload: { to: "a@x.test" }, runAt: at(-1000) },
    });
    const summary = await processBatch({ workerId: "w1", limit: 5, now });
    expect(summary.failed).toBe(1);
    const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(row).toMatchObject({ status: "FAILED", lastError: "INVALID_PAYLOAD", attempts: 1 });
    expect(transport.sent).toHaveLength(0);
  });

  it("does not overwrite a job whose lock was taken over by another worker", async () => {
    const job = await createEmailJob({ runAt: at(-1000) });
    useTransport({
      onSend: async () => {
        await prisma.job.update({ where: { id: job.id }, data: { lockedBy: "w2" } });
      },
    });
    const summary = await processBatch({ workerId: "w1", limit: 5, now });
    expect(summary.lockLost).toBe(1);
    const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(row).toMatchObject({ status: "RUNNING", lockedBy: "w2" });
  });

  it("reports lock loss when a failing send lost its lock", async () => {
    const job = await createEmailJob({ runAt: at(-1000) });
    useTransport({
      onSend: async () => {
        await prisma.job.update({ where: { id: job.id }, data: { lockedBy: "w2" } });
        throw new Error("SMTP down");
      },
    });
    const summary = await processBatch({ workerId: "w1", limit: 5, now });
    expect(summary).toMatchObject({ lockLost: 1, retried: 0 });
    const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(row).toMatchObject({ status: "RUNNING", lockedBy: "w2", attempts: 0 });
  });

  it("isolates a job whose bookkeeping crashes and keeps processing the others", async () => {
    // attempts + 1 depasse l'Int32 de MySQL : la mise a jour de cet unique job leve.
    const crashing = await prisma.job.create({
      data: {
        type: "EMAIL",
        kind: "k",
        payload: { nope: 1 },
        attempts: 2_147_483_647,
        runAt: at(-2000),
      },
    });
    const healthy = await createEmailJob({ runAt: at(-1000) });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const summary = await processBatch({ workerId: "w1", limit: 5, now });
    expect(errors).toHaveBeenCalledWith("[worker] job crashed", expect.anything());
    errors.mockRestore();
    expect(summary).toMatchObject({ claimed: 2, succeeded: 1 });
    expect((await prisma.job.findUniqueOrThrow({ where: { id: healthy.id } })).status).toBe(
      "SUCCEEDED",
    );
    expect((await prisma.job.findUniqueOrThrow({ where: { id: crashing.id } })).status).toBe(
      "RUNNING",
    );
  });

  it("reports lock loss when the final failure lost its lock", async () => {
    const job = await createEmailJob({ attempts: 4, runAt: at(-1000) });
    useTransport({
      onSend: async () => {
        await prisma.job.update({ where: { id: job.id }, data: { lockedBy: "w2" } });
        throw new Error("SMTP down");
      },
    });
    const summary = await processBatch({ workerId: "w1", limit: 5, now });
    expect(summary).toMatchObject({ lockLost: 1, failed: 0 });
    expect(await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: "RUNNING",
      attempts: 4,
    });
  });

  it("never sends the same job twice with two concurrent workers", async () => {
    for (let i = 0; i < 12; i++) await createEmailJob({ to: `u${i}@x.test`, runAt: at(-1000) });
    // Le filesort de MySQL verrouille toutes les lignes dues avant le LIMIT : les autres
    // workers en sautent donc davantage que 5 par tour. On enchaine des tours jusqu'a vider.
    let claimed = 0;
    for (let round = 0; round < 6; round++) {
      const results = await Promise.all([
        processBatch({ workerId: "a", limit: 5, now }),
        processBatch({ workerId: "b", limit: 5, now }),
        processBatch({ workerId: "c", limit: 5, now }),
      ]);
      claimed += results.reduce((n, r) => n + r.claimed, 0);
    }
    expect(transport.sent).toHaveLength(12);
    expect(new Set(transport.sent.map((m) => m.to)).size).toBe(12);
    expect(claimed).toBe(12);
  });

  it("returns an empty summary when nothing is due", async () => {
    await createEmailJob({ runAt: at(60_000) });
    expect(await processBatch({ workerId: "w1", limit: 5, now })).toEqual({
      claimed: 0,
      succeeded: 0,
      retried: 0,
      failed: 0,
      lockLost: 0,
    });
  });

  it("defaults now to the current time", async () => {
    await createEmailJob();
    expect((await processBatch({ workerId: "w1", limit: 5 })).succeeded).toBe(1);
  });
});
