import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { EMAIL_KIND } from "@/lib/jobs/enqueue-email";
import { isSensitiveEmailKind } from "@/lib/jobs/email-kinds";
import type { DemoContext } from "../../context";
import { buildWorld, teardownWorld } from "../../billing/__tests__/helpers";
import type { DemoWorld } from "../../billing/world";
import { seedJobs } from "../jobs";

const DAY_MS = 86_400_000;
const YEAR_MS = 365 * DAY_MS;
const KNOWN_KINDS = new Set<string>(Object.values(EMAIL_KIND));

describe("seedJobs", () => {
  let ctx: DemoContext;
  let world: DemoWorld;

  beforeEach(async () => {
    ({ ctx, world } = await buildWorld());
  });
  afterEach(() => teardownWorld(ctx));

  it("cree des jobs de chaque statut, tous adresses a @demo.local", async () => {
    const seeded = await seedJobs(ctx, world);
    const jobs = await prisma.job.findMany();
    expect(new Set(jobs.map((j) => j.status))).toEqual(new Set(["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]));
    expect(jobs.length).toBeGreaterThanOrEqual(12);

    for (const j of jobs) {
      expect(j.recipient!.endsWith("@demo.local")).toBe(true);
      expect((j.payload as { to: string }).to).toBe(j.recipient);
      expect(KNOWN_KINDS.has(j.kind) || /^notification\.[a-z_]+$/.test(j.kind)).toBe(true);
      if (isSensitiveEmailKind(j.kind)) expect(j.priority).toBe(10);
    }
    expect(seeded.failed.length).toBe(jobs.filter((j) => j.status === "FAILED").length);
    expect(seeded.cancelled.length).toBe(jobs.filter((j) => j.status === "CANCELLED").length);
  });

  it("garde les jobs en file et en cours hors de portee du worker", async () => {
    await seedJobs(ctx, world);
    const limit = ctx.dates.now.getTime() + YEAR_MS;
    const jobs = await prisma.job.findMany();
    for (const j of jobs.filter((x) => x.status === "PENDING")) expect(j.runAt.getTime()).toBeGreaterThan(limit);
    for (const j of jobs.filter((x) => x.status === "RUNNING")) {
      expect(j.lockedAt!.getTime()).toBeGreaterThan(limit);
      expect(j.lockedBy).not.toBeNull();
    }
    expect(jobs.some((j) => j.status === "PENDING" && j.attempts > 0)).toBe(true);
  });

  it("respecte les invariants de chaque statut terminal", async () => {
    await seedJobs(ctx, world);
    const now = ctx.dates.now.getTime();
    const jobs = await prisma.job.findMany();
    for (const j of jobs.filter((x) => ["SUCCEEDED", "FAILED", "CANCELLED"].includes(x.status))) {
      expect(j.completedAt).not.toBeNull();
      expect(now - j.completedAt!.getTime()).toBeLessThan(25 * DAY_MS);
      expect(j.completedAt!.getTime()).toBeLessThanOrEqual(now);
      expect(j.createdAt.getTime()).toBeLessThanOrEqual(j.completedAt!.getTime());
    }
    for (const j of jobs.filter((x) => x.status === "SUCCEEDED")) {
      expect((j.payload as { html: string }).html).toBe("");
      expect(j.attempts).toBeGreaterThanOrEqual(1);
    }
    for (const j of jobs.filter((x) => x.status === "FAILED")) {
      expect(j.attempts).toBe(5);
      expect(j.maxAttempts).toBe(5);
      expect(j.lastError!.length).toBeGreaterThan(0);
      expect(j.lastError!.length).toBeLessThanOrEqual(2000);
    }
  });

  it("est idempotent", async () => {
    await seedJobs(ctx, world);
    const before = await prisma.job.count();
    await seedJobs(ctx, world);
    expect(await prisma.job.count()).toBe(before);
  });
});
