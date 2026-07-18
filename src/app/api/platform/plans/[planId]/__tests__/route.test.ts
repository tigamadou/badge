import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

function noSession() {
  vi.mocked(getServerSession).mockResolvedValue(null as never);
}

async function asStaff(role: "STAFF_ADMIN" | "STAFF_OBSERVER" = "STAFF_ADMIN") {
  const u = await prisma.user.create({
    data: {
      email: `staff-planid-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@x`,
      password: "x",
      name: "S",
      isStaff: true,
      staffRole: role,
    },
  });
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, isStaff: true },
  } as never);
  return u;
}

function req(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("PATCH /api/platform/plans/[planId]", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without session", async () => {
    noSession();
    const { PATCH } = await import("@/app/api/platform/plans/[planId]/route");
    const res = await PATCH(req("/api/platform/plans/ghost", "PATCH", { name: "x" }), {
      params: Promise.resolve({ planId: "ghost" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for STAFF_OBSERVER (below STAFF_ADMIN)", async () => {
    await asStaff("STAFF_OBSERVER");
    const { PATCH } = await import("@/app/api/platform/plans/[planId]/route");
    const res = await PATCH(req("/api/platform/plans/ghost", "PATCH", { name: "x" }), {
      params: Promise.resolve({ planId: "ghost" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 for malformed JSON body", async () => {
    await asStaff();
    const plan = await prisma.plan.create({ data: { name: `plan-malformed-${Date.now()}` } });
    const { PATCH } = await import("@/app/api/platform/plans/[planId]/route");
    const res = await PATCH(
      new NextRequest(`http://localhost/api/platform/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
      { params: Promise.resolve({ planId: plan.id }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 VALIDATION for an invalid field (negative maxEvents)", async () => {
    await asStaff();
    const plan = await prisma.plan.create({ data: { name: `plan-invalid-${Date.now()}` } });
    const { PATCH } = await import("@/app/api/platform/plans/[planId]/route");
    const res = await PATCH(req(`/api/platform/plans/${plan.id}`, "PATCH", { maxEvents: -1 }), {
      params: Promise.resolve({ planId: plan.id }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION");
  });

  it("updates a plan (name/maxEvents/maxParticipantsPerEvent/archived) and logs PLAN_UPDATED", async () => {
    const staff = await asStaff();
    const plan = await prisma.plan.create({
      data: { name: `plan-update-${Date.now()}`, maxEvents: 1, maxParticipantsPerEvent: 10 },
    });
    const { PATCH } = await import("@/app/api/platform/plans/[planId]/route");
    const newName = `plan-updated-${Date.now()}`;
    const res = await PATCH(
      req(`/api/platform/plans/${plan.id}`, "PATCH", {
        name: newName,
        maxEvents: 5,
        maxParticipantsPerEvent: 50,
        archived: true,
      }),
      { params: Promise.resolve({ planId: plan.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.plan.name).toBe(newName);
    expect(json.plan.maxEvents).toBe(5);
    expect(json.plan.maxParticipantsPerEvent).toBe(50);
    expect(json.plan.archived).toBe(true);

    const log = await prisma.activityLog.findFirst({
      where: { type: "PLAN_UPDATED", targetId: plan.id },
    });
    expect(log).not.toBeNull();
    expect(log?.userId).toBe(staff.id);
    const details = log?.details as { name: string; archived: boolean };
    expect(details.name).toBe(newName);
    expect(details.archived).toBe(true);
  });

  it("returns 404 NOT_FOUND for an unknown planId (P2025)", async () => {
    await asStaff();
    const { PATCH } = await import("@/app/api/platform/plans/[planId]/route");
    const res = await PATCH(
      req("/api/platform/plans/ghost-plan-id", "PATCH", { name: `ghost-${Date.now()}` }),
      { params: Promise.resolve({ planId: "ghost-plan-id" }) },
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("NOT_FOUND");
  });

  it("returns 409 NAME_TAKEN when renaming to an already-used name", async () => {
    await asStaff();
    const takenName = `plan-taken-${Date.now()}`;
    await prisma.plan.create({ data: { name: takenName } });
    const plan = await prisma.plan.create({ data: { name: `plan-renamed-${Date.now()}` } });
    const { PATCH } = await import("@/app/api/platform/plans/[planId]/route");
    const res = await PATCH(req(`/api/platform/plans/${plan.id}`, "PATCH", { name: takenName }), {
      params: Promise.resolve({ planId: plan.id }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("NAME_TAKEN");
  });

  it("rethrows a non-P2025/P2002 prisma error", async () => {
    await asStaff();
    const plan = await prisma.plan.create({ data: { name: `plan-rethrow-${Date.now()}` } });
    const spy = vi
      .spyOn(prisma.plan, "update")
      .mockRejectedValueOnce(Object.assign(new Error("db-fail"), { code: "P2003" }));
    const { PATCH } = await import("@/app/api/platform/plans/[planId]/route");
    await expect(
      PATCH(req(`/api/platform/plans/${plan.id}`, "PATCH", { name: `x-${Date.now()}` }), {
        params: Promise.resolve({ planId: plan.id }),
      }),
    ).rejects.toThrow("db-fail");
    spy.mockRestore();
  });
});
