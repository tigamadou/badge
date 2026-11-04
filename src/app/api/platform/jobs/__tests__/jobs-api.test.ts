import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEmailJob } from "@/lib/jobs/__tests__/helpers";
import { GET as list } from "@/app/api/platform/jobs/route";
import { GET as detail } from "@/app/api/platform/jobs/[jobId]/route";
import { POST as retry } from "@/app/api/platform/jobs/[jobId]/retry/route";
import { POST as cancel } from "@/app/api/platform/jobs/[jobId]/cancel/route";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

async function makeStaff(staffRole: StaffRoleStr) {
  const u = await prisma.user.create({
    data: {
      email: `s-${Date.now()}-${Math.random()}@x`,
      password: "x",
      name: "Staff",
      isStaff: true,
      staffRole,
    },
  });
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, isStaff: true },
  } as never);
  return u;
}

const req = (path = "", method = "GET") =>
  new NextRequest(`http://localhost/api/platform/jobs${path}`, { method });
const ctx = (jobId: string) => ({ params: Promise.resolve({ jobId }) });
const call = {
  list: (q = "") => list(req(q ? `?${q}` : ""), ctx("")),
  detail: (id: string) => detail(req(`/${id}`), ctx(id)),
  retry: (id: string) => retry(req(`/${id}/retry`, "POST"), ctx(id)),
  cancel: (id: string) => cancel(req(`/${id}/cancel`, "POST"), ctx(id)),
};

beforeEach(() => {
  vi.mocked(getServerSession).mockReset();
});

describe("auth", () => {
  it.each(["list", "detail", "retry", "cancel"] as const)("401 without session on %s", async (name) => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await call[name]("x");
    expect(res.status).toBe(401);
  });

  it.each(["list", "detail", "retry", "cancel"] as const)("403 for a non-staff user on %s", async (name) => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name, isStaff: false },
    } as never);
    const res = await call[name]("x");
    expect(res.status).toBe(403);
  });
});

describe("read access", () => {
  it("STAFF_OBSERVER can list and read a job", async () => {
    await makeStaff("STAFF_OBSERVER");
    const job = await createEmailJob({ status: "FAILED" });
    const res = await call.list();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 10,
      counts: { pending: 0, failed: 1, sentLast24h: 0 },
    });
    expect(body.jobs[0].id).toBe(job.id);
    const one = await call.detail(job.id);
    expect(one.status).toBe(200);
    expect((await one.json()).job.id).toBe(job.id);
  });

  it("400 on invalid status filter", async () => {
    await makeStaff("STAFF_OBSERVER");
    const res = await call.list("status=FOO");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "INVALID_STATUS", error: "Statut inconnu." });
  });

  it("404 on unknown jobId", async () => {
    await makeStaff("STAFF_ADMIN");
    for (const name of ["detail", "retry", "cancel"] as const) {
      const res = await call[name]("nope");
      expect(res.status).toBe(404);
      expect((await res.json()).code).toBe("NOT_FOUND");
    }
  });
});

describe("actions", () => {
  it("STAFF_SUPPORT gets 403 on retry and cancel and the job is unchanged", async () => {
    await makeStaff("STAFF_SUPPORT");
    const failed = await createEmailJob({ status: "FAILED" });
    const pending = await createEmailJob();
    expect((await call.retry(failed.id)).status).toBe(403);
    expect((await call.cancel(pending.id)).status).toBe(403);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: failed.id } })).status).toBe("FAILED");
    expect((await prisma.job.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("PENDING");
  });

  it("STAFF_ADMIN retries a FAILED job and logs JOB_RETRIED", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    const job = await createEmailJob({ status: "FAILED", attempts: 5 });
    const res = await call.retry(job.id);
    expect(res.status).toBe(200);
    expect((await res.json()).job.status).toBe("PENDING");
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "JOB_RETRIED" } });
    expect(log).toMatchObject({ targetId: job.id, userId: staff.id });
    expect(log.details).toMatchObject({ kind: "registration.approved" });
  });

  it("STAFF_ADMIN cancels a PENDING job and logs JOB_CANCELLED", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    const job = await createEmailJob();
    const res = await call.cancel(job.id);
    expect(res.status).toBe(200);
    expect((await res.json()).job.status).toBe("CANCELLED");
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "JOB_CANCELLED" } });
    expect(log).toMatchObject({ targetId: job.id, userId: staff.id });
  });

  it("maps the 409 codes", async () => {
    await makeStaff("STAFF_ADMIN");
    const succeeded = await createEmailJob({ status: "SUCCEEDED" });
    const purged = await createEmailJob({ status: "FAILED", html: "" });
    const running = await createEmailJob({ status: "RUNNING" });

    const notRetryable = await call.retry(succeeded.id);
    expect(notRetryable.status).toBe(409);
    expect(await notRetryable.json()).toEqual({
      code: "JOB_NOT_RETRYABLE",
      error: "Seul un email en échec ou annulé peut être relancé.",
    });
    const gone = await call.retry(purged.id);
    expect(gone.status).toBe(409);
    expect((await gone.json()).code).toBe("JOB_PAYLOAD_PURGED");
    const notCancellable = await call.cancel(running.id);
    expect(notCancellable.status).toBe(409);
    expect((await notCancellable.json()).code).toBe("JOB_NOT_CANCELLABLE");
    expect(await prisma.activityLog.count()).toBe(0);
  });
});

describe("sensitive content", () => {
  it("never returns the html of a password reset", async () => {
    await makeStaff("STAFF_ADMIN");
    const job = await createEmailJob({
      kind: "account.password-reset",
      status: "FAILED",
      html: '<a href="/reset?token=token-secret-123">Lien</a>',
    });
    for (const res of [await call.list(), await call.detail(job.id), await call.retry(job.id)]) {
      expect(res.status).toBe(200);
      expect(await res.text()).not.toContain("token-secret-123");
    }
  });
});
