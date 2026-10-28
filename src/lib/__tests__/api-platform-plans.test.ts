import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

    // Statut EXPIRED => abonnement inactif => creation bloquee
    const expired = await PUT(
      req(`/api/platform/organizations/${org.id}/subscription`, "PUT", {
        planId: plan.id,
        status: "EXPIRED",
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(expired.status).toBe(200);
    await expect(assertCanCreateEvent(org.id)).rejects.toBeInstanceOf(SubscriptionError);

    const created = await prisma.activityLog.findFirst({
      where: { type: "SUBSCRIPTION_CREATED", orgId: org.id },
    });
    expect(created).not.toBeNull();

    // Re-activation (statut ACTIVE, dates recalculees depuis la periode) => debloque
    const active = await PUT(
      req(`/api/platform/organizations/${org.id}/subscription`, "PUT", {
        planId: plan.id,
        status: "ACTIVE",
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

describe("GET /api/platform/plans", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("lists non-archived plans by default (no ?archived)", async () => {
    await asStaff("STAFF_OBSERVER");
    const active = await prisma.plan.create({ data: { name: `active-${Date.now()}` } });
    const archived = await prisma.plan.create({
      data: { name: `archived-${Date.now()}`, archived: true },
    });
    const { GET } = await import("@/app/api/platform/plans/route");
    const res = await GET(req("/api/platform/plans", "GET"), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const { plans } = await res.json();
    const ids = plans.map((p: { id: string }) => p.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(archived.id);
  });

  it("lists archived plans with ?archived=true", async () => {
    await asStaff("STAFF_OBSERVER");
    const active = await prisma.plan.create({ data: { name: `active2-${Date.now()}` } });
    const archived = await prisma.plan.create({
      data: { name: `archived2-${Date.now()}`, archived: true },
    });
    const { GET } = await import("@/app/api/platform/plans/route");
    const res = await GET(req("/api/platform/plans?archived=true", "GET"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    const { plans } = await res.json();
    const ids = plans.map((p: { id: string }) => p.id);
    expect(ids).toContain(archived.id);
    expect(ids).not.toContain(active.id);
  });
});

describe("POST /api/platform/plans — validation, defaults, conflicts", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for malformed JSON body", async () => {
    await asStaff();
    const { POST } = await import("@/app/api/platform/plans/route");
    const res = await POST(
      new NextRequest("http://localhost/api/platform/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(400);
  });

  it("defaults maxEvents/maxParticipantsPerEvent to null when omitted", async () => {
    await asStaff();
    const { POST } = await import("@/app/api/platform/plans/route");
    const name = `no-limits-${Date.now()}`;
    const res = await POST(req("/api/platform/plans", "POST", { name }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(201);
    const { plan } = await res.json();
    expect(plan.maxEvents).toBeNull();
    expect(plan.maxParticipantsPerEvent).toBeNull();
  });

  it("creates a plan with a price and logs it", async () => {
    await asStaff();
    const { POST } = await import("@/app/api/platform/plans/route");
    const res = await POST(
      req("/api/platform/plans", "POST", { name: `priced-${Date.now()}`, price: 15000 }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(201);
    const { plan } = await res.json();
    expect(plan.price).toBe(15000);
    const log = await prisma.activityLog.findFirst({
      where: { type: "PLAN_CREATED", targetId: plan.id },
    });
    expect((log?.details as { price: number }).price).toBe(15000);
  });

  it("defaults price to null when omitted", async () => {
    await asStaff();
    const { POST } = await import("@/app/api/platform/plans/route");
    const res = await POST(req("/api/platform/plans", "POST", { name: `noprice-${Date.now()}` }), {
      params: Promise.resolve({}),
    });
    const { plan } = await res.json();
    expect(plan.price).toBeNull();
  });

  it("returns 400 VALIDATION for a price below 100", async () => {
    await asStaff();
    const { POST } = await import("@/app/api/platform/plans/route");
    const res = await POST(
      req("/api/platform/plans", "POST", { name: `lowprice-${Date.now()}`, price: 50 }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION");
  });

  it("returns 409 NAME_TAKEN when the name is already used", async () => {
    await asStaff();
    const name = `dup-${Date.now()}`;
    await prisma.plan.create({ data: { name } });
    const { POST } = await import("@/app/api/platform/plans/route");
    const res = await POST(req("/api/platform/plans", "POST", { name }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("NAME_TAKEN");
  });

  it("rethrows a non-P2002 prisma error", async () => {
    await asStaff();
    const spy = vi
      .spyOn(prisma.plan, "create")
      .mockRejectedValueOnce(Object.assign(new Error("db-fail"), { code: "P2003" }));
    const { POST } = await import("@/app/api/platform/plans/route");
    await expect(
      POST(req("/api/platform/plans", "POST", { name: `spy-${Date.now()}` }), {
        params: Promise.resolve({}),
      }),
    ).rejects.toThrow("db-fail");
    spy.mockRestore();
  });
});

describe("PUT /api/platform/organizations/[orgId]/subscription — validation & not-found", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("rejects malformed JSON body with 400", async () => {
    await asStaff();
    const org = await prisma.organization.create({
      data: { name: "OrgBad", slug: `orgbad-${Date.now()}` },
    });
    const { PUT } = await import(
      "@/app/api/platform/organizations/[orgId]/subscription/route"
    );
    const res = await PUT(
      new NextRequest(
        `http://localhost/api/platform/organizations/${org.id}/subscription`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: "{not-json",
        },
      ),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a missing planId with 400 VALIDATION", async () => {
    await asStaff();
    const org = await prisma.organization.create({
      data: { name: "OrgDate", slug: `orgdate-${Date.now()}` },
    });
    const { PUT } = await import(
      "@/app/api/platform/organizations/[orgId]/subscription/route"
    );
    const res = await PUT(
      req(`/api/platform/organizations/${org.id}/subscription`, "PUT", {
        status: "ACTIVE",
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION");
  });

  it("returns 404 ORG_NOT_FOUND for an unknown orgId", async () => {
    await asStaff();
    const plan = await prisma.plan.create({ data: { name: `plan-orgnf-${Date.now()}` } });
    const { PUT } = await import(
      "@/app/api/platform/organizations/[orgId]/subscription/route"
    );
    const res = await PUT(
      req(`/api/platform/organizations/ghost-org/subscription`, "PUT", {
        planId: plan.id,
        status: "ACTIVE",
      }),
      { params: Promise.resolve({ orgId: "ghost-org" }) },
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("ORG_NOT_FOUND");
  });

  it("returns 404 PLAN_NOT_FOUND for an unknown planId", async () => {
    await asStaff();
    const org = await prisma.organization.create({
      data: { name: "OrgPlanNf", slug: `orgplannf-${Date.now()}` },
    });
    const { PUT } = await import(
      "@/app/api/platform/organizations/[orgId]/subscription/route"
    );
    const res = await PUT(
      req(`/api/platform/organizations/${org.id}/subscription`, "PUT", {
        planId: "ghost-plan",
        status: "ACTIVE",
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("PLAN_NOT_FOUND");
  });

  it("computes dates from the plan's period (ANNUAL -> +365j)", async () => {
    await asStaff();
    const org = await prisma.organization.create({
      data: { name: "OrgStart", slug: `orgstart-${Date.now()}` },
    });
    const plan = await prisma.plan.create({
      data: { name: `plan-start-${Date.now()}`, period: "ANNUAL" },
    });
    const { PUT } = await import(
      "@/app/api/platform/organizations/[orgId]/subscription/route"
    );
    const res = await PUT(
      req(`/api/platform/organizations/${org.id}/subscription`, "PUT", {
        planId: plan.id,
        status: "ACTIVE",
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(res.status).toBe(200);
    const { subscription } = await res.json();
    const days = Math.round(
      (new Date(subscription.endDate).getTime() - new Date(subscription.startDate).getTime()) /
        86_400_000,
    );
    expect(days).toBe(365);
  });

  it("creates a subscription without startDate (falls back to prisma @default(now()))", async () => {
    await asStaff();
    const org = await prisma.organization.create({
      data: { name: "OrgNoStart", slug: `orgnostart-${Date.now()}` },
    });
    const plan = await prisma.plan.create({ data: { name: `plan-nostart-${Date.now()}` } });
    const before = Date.now();
    const { PUT } = await import(
      "@/app/api/platform/organizations/[orgId]/subscription/route"
    );
    const res = await PUT(
      req(`/api/platform/organizations/${org.id}/subscription`, "PUT", {
        planId: plan.id,
        status: "ACTIVE",
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(res.status).toBe(200);
    const { subscription } = await res.json();
    expect(new Date(subscription.startDate).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});
