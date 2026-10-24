import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { __mailTesting } from "@/lib/mail";
import { createWorkerLoop } from "@/lib/jobs/worker-loop";
import type { BatchSummary } from "@/lib/jobs/process-batch";
import { PURGE_INTERVAL_MS } from "@/lib/jobs/constants";
import { createEmailJob, fakeTransport } from "./helpers";

const config = { pollIntervalMs: 10, emailConcurrency: 5 };
const empty: BatchSummary = { claimed: 0, succeeded: 0, retried: 0, failed: 0, lockLost: 0 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = new Date("2026-10-24T10:00:00.000Z");
const MIN = 60_000;

beforeEach(() => fakeTransport().install());
afterEach(() => __mailTesting.reset());

describe("createWorkerLoop", () => {
  it("runOnce sends due jobs and returns the summary", async () => {
    await createEmailJob({ to: "a@x.test" });
    await createEmailJob({ to: "b@x.test" });
    const loop = createWorkerLoop({ workerId: "w", config });
    expect((await loop.runOnce()).succeeded).toBe(2);
  });

  it("runOnce purges at most once per PURGE_INTERVAL_MS", async () => {
    const purgeOldJobs = vi.fn(async () => 0);
    const loop = createWorkerLoop({ workerId: "w", config, deps: { purgeOldJobs } });
    await loop.runOnce(t0);
    await loop.runOnce(new Date(t0.getTime() + 10 * MIN));
    await loop.runOnce(new Date(t0.getTime() + PURGE_INTERVAL_MS + MIN));
    expect(purgeOldJobs).toHaveBeenCalledTimes(2);
  });

  it("la passe de rétention purge aussi les notifications lues de plus de 90 jours", async () => {
    const user = await prisma.user.create({ data: { email: "ret@x.test", password: "x", name: "R" } });
    const base = { userId: user.id, type: "ORG_CREATED" as const, scope: "PLATFORM" as const, title: "t", body: "b" };
    const day = 24 * 60 * MIN;
    await prisma.notification.create({ data: { ...base, readAt: new Date(t0.getTime() - 100 * day) } });
    const recent = await prisma.notification.create({ data: { ...base, readAt: new Date(t0.getTime() - 10 * day) } });
    const log = vi.fn();
    const loop = createWorkerLoop({ workerId: "w", config, log });
    await loop.runOnce(t0);
    const left = await prisma.notification.findMany();
    expect(left.map((n) => n.id)).toEqual([recent.id]);
    expect(log).toHaveBeenCalledWith("[worker] purged read notifications", { purged: 1 });
  });

  it("runOnce recovers stale jobs before claiming", async () => {
    await createEmailJob({
      status: "RUNNING",
      lockedAt: new Date(Date.now() - 11 * MIN),
      lockedBy: "dead",
    });
    const loop = createWorkerLoop({ workerId: "w", config });
    expect((await loop.runOnce()).succeeded).toBe(1);
  });

  it("logs recovered and purged counts when non-zero", async () => {
    const log = vi.fn();
    const loop = createWorkerLoop({
      workerId: "w",
      config,
      log,
      deps: {
        recoverStaleJobs: async () => 2,
        purgeOldJobs: async () => 3,
        processBatch: async () => empty,
      },
    });
    await loop.runOnce();
    expect(log).toHaveBeenCalledWith("[worker] recovered stale jobs", { recovered: 2 });
    expect(log).toHaveBeenCalledWith("[worker] purged old jobs", { purged: 3 });
  });

  it("start keeps looping after a failing tick and logs it", async () => {
    const log = vi.fn();
    const processBatch = vi
      .fn<() => Promise<BatchSummary>>()
      .mockRejectedValueOnce(new Error("db gone"))
      .mockResolvedValueOnce({ ...empty, claimed: 1, succeeded: 1 })
      .mockResolvedValue(empty);
    const loop = createWorkerLoop({ workerId: "w", config, log, deps: { processBatch } });
    const running = loop.start();
    await sleep(80);
    await loop.stop();
    await running;
    expect(processBatch.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("tick failed"), { error: "db gone" });
    expect(log).toHaveBeenCalledWith("[worker] batch", expect.objectContaining({ claimed: 1 }));
  });

  it("logs a non-Error failure as a string", async () => {
    const log = vi.fn();
    const processBatch = vi.fn(async () => Promise.reject("boom"));
    const loop = createWorkerLoop({ workerId: "w", config, log, deps: { processBatch } });
    const running = loop.start();
    await sleep(30);
    await loop.stop();
    await running;
    expect(log).toHaveBeenCalledWith(expect.stringContaining("tick failed"), { error: "boom" });
  });

  it("stop waits for the in-flight batch and claims nothing afterwards", async () => {
    const processBatch = vi.fn(async () => {
      await sleep(50);
      return empty;
    });
    const loop = createWorkerLoop({ workerId: "w", config, deps: { processBatch } });
    const running = loop.start();
    await sleep(10);
    const t = Date.now();
    await loop.stop();
    expect(Date.now() - t).toBeGreaterThanOrEqual(30);
    await running;
    await sleep(50);
    expect(processBatch).toHaveBeenCalledTimes(1);
  });

  it("stop interrupts the idle wait immediately", async () => {
    const processBatch = vi.fn(async () => empty);
    const loop = createWorkerLoop({
      workerId: "w",
      config: { ...config, pollIntervalMs: 60_000 },
      deps: { processBatch },
    });
    const running = loop.start();
    await sleep(30);
    const t = Date.now();
    await loop.stop();
    await running;
    expect(Date.now() - t).toBeLessThan(200);
  });

  it("works with the default log", async () => {
    const loop = createWorkerLoop({ workerId: "w", config });
    const running = loop.start();
    await sleep(20);
    await loop.stop();
    await running;
  });
});
