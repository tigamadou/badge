import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  cancelJob,
  getJobCounts,
  getJobDetail,
  listJobKinds,
  listJobs,
  parseJobListFilters,
  retryJob,
} from "@/lib/jobs/admin";
import { createEmailJob } from "./helpers";

const now = new Date("2026-10-24T10:00:00.000Z");
const HOUR = 3_600_000;
const params = (q: string) => new URLSearchParams(q);

describe("parseJobListFilters", () => {
  it("returns the defaults", () => {
    expect(parseJobListFilters(params(""))).toEqual({
      ok: true,
      filters: { page: 1, pageSize: 20 },
    });
  });

  it("rejects an unknown status", () => {
    expect(parseJobListFilters(params("status=FOO"))).toEqual({
      ok: false,
      code: "INVALID_STATUS",
    });
  });

  it("clamps page and pageSize, ignores an invalid date", () => {
    const r = parseJobListFilters(params("page=-3&pageSize=999&from=pas-une-date&to=2026-13-45"));
    expect(r).toEqual({ ok: true, filters: { page: 1, pageSize: 20 } });
  });

  it("makes the `to` day inclusive and keeps the other filters", () => {
    const r = parseJobListFilters(
      params("status=FAILED&kind=k&from=2026-10-01&to=2026-10-24&q=%20bob%20&page=3&pageSize=10"),
    );
    expect(r).toEqual({
      ok: true,
      filters: {
        status: "FAILED",
        kind: "k",
        from: new Date("2026-10-01T00:00:00.000Z"),
        to: new Date("2026-10-25T00:00:00.000Z"),
        q: "bob",
        page: 3,
        pageSize: 10,
      },
    });
  });
});

describe("listJobs", () => {
  it("filters by status, kind, period and recipient and paginates", async () => {
    for (let i = 0; i < 25; i++) {
      await createEmailJob({
        to: `bob${i}@x.test`,
        kind: "k.a",
        createdAt: new Date(now.getTime() - i * HOUR),
      });
    }
    await createEmailJob({ to: "other@x.test", kind: "k.b", status: "FAILED", createdAt: now });
    await createEmailJob({ to: "old@x.test", kind: "k.a", createdAt: new Date("2026-01-01") });

    const base = { page: 1, pageSize: 10 };
    const page3 = await listJobs({ ...base, page: 3, kind: "k.a", from: new Date("2026-10-23") });
    expect(page3.jobs).toHaveLength(5);
    expect(page3.total).toBe(25);
    expect((await listJobs({ ...base, status: "FAILED" })).total).toBe(1);
    expect((await listJobs({ ...base, q: "other" })).jobs[0].recipient).toBe("other@x.test");
    expect(
      (await listJobs({ ...base, to: new Date("2026-02-01"), from: new Date("2025-12-01") })).total,
    ).toBe(1);
    expect((await listJobs({ ...base, to: new Date("2026-02-01") })).total).toBe(1);
  });

  it("never returns the payload", async () => {
    await createEmailJob();
    const { jobs } = await listJobs({ page: 1, pageSize: 10 });
    expect(Object.keys(jobs[0])).not.toContain("payload");
  });
});

describe("listJobKinds", () => {
  it("returns distinct kinds sorted", async () => {
    await createEmailJob({ kind: "b.kind" });
    await createEmailJob({ kind: "a.kind" });
    await createEmailJob({ kind: "b.kind" });
    expect(await listJobKinds()).toEqual(["a.kind", "b.kind"]);
  });
});

describe("getJobCounts", () => {
  it("counts pending+running, failed and successes of the last 24 h", async () => {
    await createEmailJob({ status: "PENDING" });
    await createEmailJob({ status: "RUNNING" });
    await createEmailJob({ status: "FAILED" });
    await createEmailJob({ status: "SUCCEEDED", completedAt: new Date(now.getTime() - 23 * HOUR) });
    await createEmailJob({ status: "SUCCEEDED", completedAt: new Date(now.getTime() - 25 * HOUR) });
    expect(await getJobCounts(now)).toEqual({ pending: 2, failed: 1, sentLast24h: 1 });
  });

  it("defaults now to the current time", async () => {
    expect(await getJobCounts()).toEqual({ pending: 0, failed: 0, sentLast24h: 0 });
  });
});

describe("getJobDetail", () => {
  it("hides the html of a sensitive kind", async () => {
    const job = await createEmailJob({ kind: "account.password-reset", html: "<a>token-secret-123</a>" });
    const detail = await getJobDetail(job.id);
    expect(detail).toMatchObject({ sensitive: true, previewHtml: null, subject: "Sujet" });
    expect(JSON.stringify(detail)).not.toContain("token-secret-123");
  });

  it("exposes the preview of a business email", async () => {
    const job = await createEmailJob({ html: "<p>Visible</p>", status: "FAILED" });
    expect(await getJobDetail(job.id)).toMatchObject({
      sensitive: false,
      purged: false,
      previewHtml: "<p>Visible</p>",
      canRetry: true,
      canCancel: false,
    });
  });

  it("flags a purged or unreadable payload", async () => {
    const purged = await createEmailJob({ html: "", status: "SUCCEEDED" });
    expect(await getJobDetail(purged.id)).toMatchObject({ purged: true, previewHtml: null, canRetry: false });
    const broken = await prisma.job.create({ data: { type: "EMAIL", kind: "k", payload: "oops" } });
    expect(await getJobDetail(broken.id)).toMatchObject({ purged: true, subject: null, canCancel: true });
  });

  it("returns null for an unknown id", async () => {
    expect(await getJobDetail("nope")).toBeNull();
  });
});

describe("retryJob", () => {
  it.each(["FAILED", "CANCELLED"] as const)("requeues a %s job", async (status) => {
    const job = await createEmailJob({
      status,
      attempts: 5,
      lastError: "SMTP down",
      completedAt: now,
      lockedAt: now,
      lockedBy: "w",
    });
    const r = await retryJob(job.id, now);
    expect(r.ok).toBe(true);
    const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(row).toMatchObject({
      status: "PENDING",
      attempts: 0,
      runAt: now,
      completedAt: null,
      lockedAt: null,
      lockedBy: null,
      lastError: "SMTP down",
    });
  });

  it.each(["SUCCEEDED", "PENDING", "RUNNING"] as const)("refuses a %s job", async (status) => {
    const job = await createEmailJob({ status });
    expect(await retryJob(job.id)).toEqual({ ok: false, code: "JOB_NOT_RETRYABLE" });
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(status);
  });

  it("refuses a FAILED job whose html was purged", async () => {
    const job = await createEmailJob({ status: "FAILED", html: "" });
    expect(await retryJob(job.id)).toEqual({ ok: false, code: "JOB_PAYLOAD_PURGED" });
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("FAILED");
  });

  it("returns NOT_FOUND for an unknown id", async () => {
    expect(await retryJob("nope")).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("defaults now to the current time", async () => {
    const job = await createEmailJob({ status: "FAILED" });
    const before = Date.now();
    await retryJob(job.id);
    const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(row.runAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});

describe("cancelJob", () => {
  it("cancels a PENDING job", async () => {
    const job = await createEmailJob();
    const r = await cancelJob(job.id, now);
    expect(r.ok).toBe(true);
    const row = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(row).toMatchObject({ status: "CANCELLED", completedAt: now });
  });

  it("refuses a RUNNING job and leaves it untouched", async () => {
    const job = await createEmailJob({ status: "RUNNING", lockedAt: now, lockedBy: "w1" });
    const before = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(await cancelJob(job.id)).toEqual({ ok: false, code: "JOB_NOT_CANCELLABLE" });
    expect(await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).toEqual(before);
  });

  it("returns NOT_FOUND for an unknown id and defaults now", async () => {
    expect(await cancelJob("nope")).toEqual({ ok: false, code: "NOT_FOUND" });
    const job = await createEmailJob();
    expect((await cancelJob(job.id)).ok).toBe(true);
  });
});
