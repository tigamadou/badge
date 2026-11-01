import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { __mailTesting } from "@/lib/mail";
import { createWorkerLoop } from "@/lib/jobs/worker-loop";
import type { BatchSummary } from "@/lib/jobs/process-batch";
import { PURGE_INTERVAL_MS, SUBSCRIPTION_SWEEP_INTERVAL_MS } from "@/lib/jobs/constants";
import { createEmailJob, fakeTransport } from "./helpers";

const config = { pollIntervalMs: 10, emailConcurrency: 5 };
const empty: BatchSummary = { claimed: 0, succeeded: 0, retried: 0, failed: 0, lockLost: 0 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = new Date("2026-10-24T10:00:00.000Z");
const MIN = 60_000;

beforeEach(() => fakeTransport().install());
afterEach(() => __mailTesting.reset());

const noRelease = async () => false;
const noGen = {
  release: noRelease,
  claim: async () => null,
  run: async () => "DONE" as const,
  recover: async () => 0,
};

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

  it("runSubscriptionSweep : au premier passage, pas à +10 min, de nouveau à +1 h", async () => {
    const sweep = { settled: 0, reminded: 0, reconciled: 0, expired: 0 };
    const runSubscriptionSweep = vi.fn(async () => sweep);
    const loop = createWorkerLoop({ workerId: "w", config, deps: { runSubscriptionSweep } });
    await loop.runOnce(t0);
    await loop.runOnce(new Date(t0.getTime() + 10 * MIN));
    expect(runSubscriptionSweep).toHaveBeenCalledTimes(1);
    await loop.runOnce(new Date(t0.getTime() + SUBSCRIPTION_SWEEP_INTERVAL_MS));
    expect(runSubscriptionSweep).toHaveBeenCalledTimes(2);
  });

  it("logge la passe d'abonnements seulement si un compteur est non nul", async () => {
    const log = vi.fn();
    const runSubscriptionSweep = vi
      .fn()
      .mockResolvedValueOnce({ settled: 1, reminded: 2, reconciled: 0, expired: 0 })
      .mockResolvedValueOnce({ settled: 0, reminded: 0, reconciled: 0, expired: 0 });
    const loop = createWorkerLoop({ workerId: "w", config, log, deps: { runSubscriptionSweep } });
    await loop.runOnce(t0);
    expect(log).toHaveBeenCalledWith("[worker] subscription sweep", { settled: 1, reminded: 2, reconciled: 0, expired: 0 });
    log.mockClear();
    await loop.runOnce(new Date(t0.getTime() + SUBSCRIPTION_SWEEP_INTERVAL_MS));
    expect(log).not.toHaveBeenCalledWith("[worker] subscription sweep", expect.anything());
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

  describe("planches d'impression", () => {
    const row = { id: "g1" } as never;

    it("recover à chaque tour, claim puis run sans attendre ; emails traités", async () => {
      let finish!: () => void;
      const run = vi.fn(() => new Promise<"DONE">((r) => (finish = () => r("DONE"))));
      const claim = vi.fn().mockResolvedValueOnce(row).mockResolvedValue(null);
      const recover = vi.fn(async () => 0);
      const processBatch = vi.fn(async () => empty);
      const log = vi.fn();
      const loop = createWorkerLoop({
        workerId: "w",
        config,
        log,
        deps: { processBatch, printSheets: { release: noRelease, claim, run, recover } },
      });
      await loop.runOnce(t0);
      expect(run).toHaveBeenCalledWith("g1", "w");
      expect(processBatch).toHaveBeenCalledTimes(1);
      // run ne se termine pas : le tour suivant traite les emails sans nouveau claim
      await loop.runOnce(t0);
      expect(processBatch).toHaveBeenCalledTimes(2);
      expect(recover).toHaveBeenCalledTimes(2);
      expect(claim).toHaveBeenCalledTimes(1);
      finish();
      await sleep(5);
      expect(log).toHaveBeenCalledWith("[worker] print generation finished", { id: "g1", outcome: "DONE" });
      await loop.runOnce(t0);
      expect(claim).toHaveBeenCalledTimes(2);
    });

    it("stop() n'attend pas la génération", async () => {
      const run = vi.fn(() => new Promise<"DONE">(() => {}));
      const claim = vi.fn().mockResolvedValueOnce(row).mockResolvedValue(null);
      const loop = createWorkerLoop({
        workerId: "w",
        config,
        deps: { processBatch: async () => empty, printSheets: { release: noRelease, claim, run, recover: async () => 0 } },
      });
      const running = loop.start();
      await sleep(30);
      await Promise.race([loop.stop(), sleep(500).then(() => Promise.reject(new Error("bloque")))]);
      await running;
    });

    it("stop() libere la generation en cours pour qu'un autre worker la reprenne", async () => {
      const run = vi.fn(() => new Promise<"DONE">(() => {}));
      const claim = vi.fn().mockResolvedValueOnce(row).mockResolvedValue(null);
      const release = vi.fn(async () => true);
      const log = vi.fn();
      const loop = createWorkerLoop({
        workerId: "w",
        config,
        log,
        deps: { processBatch: async () => empty, printSheets: { release, claim, run, recover: async () => 0 } },
      });
      const running = loop.start();
      await sleep(30);
      await loop.stop();
      await running;
      expect(release).toHaveBeenCalledTimes(1);
      expect(release).toHaveBeenCalledWith("g1", "w");
      expect(log).toHaveBeenCalledWith("[worker] print generation released", { id: "g1", released: true });
    });

    it("stop() sans generation en cours, ou deja terminee, ne libere rien", async () => {
      const release = vi.fn(async () => true);
      const claim = vi.fn().mockResolvedValueOnce(row).mockResolvedValue(null);
      const run = vi.fn(async () => "DONE" as const);
      const loop = createWorkerLoop({
        workerId: "w",
        config,
        deps: { processBatch: async () => empty, printSheets: { release, claim, run, recover: async () => 0 } },
      });
      await loop.runOnce(t0);
      await sleep(10); // la generation est terminee
      await loop.stop();
      expect(release).not.toHaveBeenCalled();
      const idle = createWorkerLoop({ workerId: "w", config, deps: { processBatch: async () => empty, printSheets: { ...noGen, release } } });
      await idle.stop();
      expect(release).not.toHaveBeenCalled();
    });

    it("un echec de liberation est journalise sans empecher l'arret", async () => {
      const run = vi.fn(() => new Promise<"DONE">(() => {}));
      const claim = vi.fn().mockResolvedValue(row);
      const release = vi.fn().mockRejectedValueOnce(new Error("db")).mockRejectedValueOnce("x");
      const log = vi.fn();
      const mk = () =>
        createWorkerLoop({
          workerId: "w",
          config,
          log,
          deps: { processBatch: async () => empty, printSheets: { release, claim, run, recover: async () => 0 } },
        });
      for (const error of ["db", "x"]) {
        const loop = mk();
        await loop.runOnce(t0);
        await loop.stop();
        expect(log).toHaveBeenCalledWith("[worker] print generation release failed", { id: "g1", error });
      }
    });

    it("apres stop(), plus aucune generation n'est reservee", async () => {
      const claim = vi.fn().mockResolvedValue(row);
      const recover = vi.fn(async () => 0);
      const loop = createWorkerLoop({
        workerId: "w",
        config,
        deps: { processBatch: async () => empty, printSheets: { ...noGen, claim, recover } },
      });
      await loop.stop();
      await loop.runOnce(t0);
      expect(claim).not.toHaveBeenCalled();
    });

    it("runOnce sans planches (mode --once) ne reprend ni ne reserve de generation, mais envoie les emails", async () => {
      const claim = vi.fn().mockResolvedValue(row);
      const recover = vi.fn(async () => 0);
      const processBatch = vi.fn(async () => empty);
      const loop = createWorkerLoop({
        workerId: "w",
        config,
        deps: { processBatch, printSheets: { ...noGen, claim, recover } },
      });
      await loop.runOnce(t0, { printSheets: false });
      expect(claim).not.toHaveBeenCalled();
      expect(recover).not.toHaveBeenCalled();
      expect(processBatch).toHaveBeenCalledTimes(1);
    });

    it("journalise un run qui plante, puis libère le worker", async () => {
      const log = vi.fn();
      const run = vi.fn().mockRejectedValueOnce(new Error("kaboom")).mockRejectedValueOnce("str");
      const claim = vi.fn().mockResolvedValue(row);
      const loop = createWorkerLoop({
        workerId: "w",
        config,
        log,
        deps: { processBatch: async () => empty, printSheets: { release: noRelease, claim, run, recover: async () => 0 } },
      });
      await loop.runOnce(t0);
      await sleep(5);
      expect(log).toHaveBeenCalledWith("[worker] print generation crashed", { id: "g1", error: "kaboom" });
      await loop.runOnce(t0);
      await sleep(5);
      expect(log).toHaveBeenCalledWith("[worker] print generation crashed", { id: "g1", error: "str" });
      expect(run).toHaveBeenCalledTimes(2);
    });

    it("un journal qui jette ne provoque ni rejet non gere ni blocage", async () => {
      const unhandled = vi.fn();
      process.on("unhandledRejection", unhandled);
      const log = vi.fn(() => {
        throw new Error("log HS");
      });
      const run = vi.fn().mockResolvedValueOnce("DONE").mockRejectedValueOnce(new Error("x"));
      const claim = vi.fn().mockResolvedValue(row);
      const processBatch = vi.fn(async () => empty);
      const loop = createWorkerLoop({
        workerId: "w",
        config,
        log,
        deps: { processBatch, printSheets: { release: noRelease, claim, run, recover: async () => 1 } },
      });
      await loop.runOnce(t0);
      await sleep(10);
      await loop.runOnce(t0);
      await sleep(10);
      // le worker est libere malgre le journal defaillant : un 3e claim a lieu
      await loop.runOnce(t0);
      expect(run).toHaveBeenCalledTimes(3);
      expect(processBatch).toHaveBeenCalledTimes(3);
      process.off("unhandledRejection", unhandled);
      expect(unhandled).not.toHaveBeenCalled();
    });

    it("une erreur de claim/recover ne bloque pas les emails et est journalisée", async () => {
      const log = vi.fn();
      const processBatch = vi.fn(async () => empty);
      const recover = vi
        .fn()
        .mockRejectedValueOnce(new Error("db"))
        .mockResolvedValueOnce(2)
        .mockRejectedValueOnce("x");
      const loop = createWorkerLoop({
        workerId: "w",
        config,
        log,
        deps: { processBatch, printSheets: { ...noGen, recover } },
      });
      await loop.runOnce(t0);
      expect(log).toHaveBeenCalledWith("[worker] print generation dispatch failed", { error: "db" });
      await loop.runOnce(t0);
      expect(log).toHaveBeenCalledWith("[worker] recovered stale print generations", { recovered: 2 });
      await loop.runOnce(t0);
      expect(log).toHaveBeenCalledWith("[worker] print generation dispatch failed", { error: "x" });
      expect(processBatch).toHaveBeenCalledTimes(3);
    });
  });
});
