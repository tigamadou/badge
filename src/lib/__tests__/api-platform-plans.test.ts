import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function asStaff(role: "STAFF_ADMIN" | "STAFF_OBSERVER" = "STAFF_ADMIN") {
  const u = await prisma.user.create({
    data: { email: `staff-${role}-${Date.now()}@x`, password: "x", name: "S", isStaff: true, staffRole: role },
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

describe("Plans + Subscription platform API", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("STAFF_OBSERVER cannot create a plan (403)", async () => {
    await asStaff("STAFF_OBSERVER");
    const { POST } = await import("@/app/api/platform/plans/route");
    const res = await POST(req("/api/platform/plans", "POST", { name: `p-obs-${Date.now()}` }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN creates a plan and logs PLAN_CREATED", async () => {
    const staff = await asStaff();
    const { POST } = await import("@/app/api/platform/plans/route");
    const name = `Gratuit-${Date.now()}`;
    const res = await POST(
      req("/api/platform/plans", "POST", { name, maxEvents: 1, maxParticipantsPerEvent: 100 }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(201);
    const { plan } = await res.json();
    expect(plan.maxEvents).toBe(1);
    const log = await prisma.activityLog.findFirst({
      where: { type: "PLAN_CREATED", targetId: plan.id },
    });
    expect(log?.userId).toBe(staff.id);
  });

  it("assign expired subscription blocks event creation, ACTIVE unblocks", async () => {
    await asStaff();
    const org = await prisma.organization.create({
      data: { name: "Sub", slug: `sub-${Date.now()}` },
    });
    const plan = await prisma.plan.create({
      data: { name: `plan-sub-${Date.now()}`, maxEvents: 10, maxParticipantsPerEvent: 100 },
    });

    const { PUT } = await import(
      "@/app/api/platform/organizations/[orgId]/subscription/route"
    );
    const { assertCanCreateEvent, SubscriptionError } = await import("@/lib/subscription");

    // Expired endDate => blocked
    const expired = await PUT(
      req(`/api/platform/organizations/${org.id}/subscription`, "PUT", {
        planId: plan.id,
        status: "ACTIVE",
        endDate: "2000-01-01",
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(expired.status).toBe(200);
    await expect(assertCanCreateEvent(org.id)).rejects.toBeInstanceOf(SubscriptionError);

    const created = await prisma.activityLog.findFirst({
      where: { type: "SUBSCRIPTION_CREATED", orgId: org.id },
    });
    expect(created).not.toBeNull();

    // Re-activate with valid dates => unblocked
    const active = await PUT(
      req(`/api/platform/organizations/${org.id}/subscription`, "PUT", {
        planId: plan.id,
        status: "ACTIVE",
        endDate: null,
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(active.status).toBe(200);
    await expect(assertCanCreateEvent(org.id)).resolves.toBeUndefined();

    const updated = await prisma.activityLog.findFirst({
      where: { type: "SUBSCRIPTION_UPDATED", orgId: org.id },
    });
    expect(updated).not.toBeNull();
  });
});
