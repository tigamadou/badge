import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PLAN_NAME } from "@/lib/subscription";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

function withStaffSession(user: { id: string; email: string; name: string }) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { ...user, isStaff: true },
  } as never);
}

async function seedStaff(
  staffRole: "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER" = "STAFF_ADMIN",
) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return prisma.user.create({
    data: {
      email: `staff-sub-${stamp}@x.test`,
      password: "x",
      name: "S",
      emailVerifiedAt: new Date(),
      isStaff: true,
      staffRole,
    },
  });
}

async function seedOrg() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return prisma.organization.create({ data: { name: "O", slug: `o-sub-${stamp}` } });
}

async function seedPlan(period: "MONTHLY" | "ANNUAL" = "MONTHLY") {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return prisma.plan.create({
    data: { name: `plan-sub-${stamp}`, period, maxEvents: 5, maxParticipantsPerEvent: 100 },
  });
}

async function callPut(orgId: string, body: unknown) {
  const { PUT } = await import("../route");
  return PUT(
    new NextRequest("http://localhost/x", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ orgId }) },
  );
}

const DAY_MS = 86_400_000;

describe("PUT /api/platform/organizations/[orgId]/subscription", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("assigne un plan mensuel et calcule endDate = +30j (periode du plan)", async () => {
    const staff = await seedStaff();
    const org = await seedOrg();
    const plan = await seedPlan("MONTHLY");
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    const res = await callPut(org.id, { planId: plan.id, status: "ACTIVE" });
    expect(res.status).toBe(200);

    const sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(Math.round((sub!.endDate!.getTime() - sub!.startDate.getTime()) / DAY_MS)).toBe(30);
  });

  it("assigne un plan annuel et calcule endDate = +365j (periode du plan)", async () => {
    const staff = await seedStaff();
    const org = await seedOrg();
    const plan = await seedPlan("ANNUAL");
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    const res = await callPut(org.id, { planId: plan.id, status: "ACTIVE" });
    expect(res.status).toBe(200);

    const sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(Math.round((sub!.endDate!.getTime() - sub!.startDate.getTime()) / DAY_MS)).toBe(365);
  });

  it("assigne le plan free : sans echeance (endDate null)", async () => {
    const staff = await seedStaff();
    const org = await seedOrg();
    const plan = await prisma.plan.create({
      data: { name: DEFAULT_PLAN_NAME, maxEvents: 1, maxParticipantsPerEvent: 100 },
    });
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    const res = await callPut(org.id, { planId: plan.id, status: "ACTIVE" });
    expect(res.status).toBe(200);

    const sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(sub?.endDate).toBeNull();
  });

  it("refuse un planId manquant (400)", async () => {
    const staff = await seedStaff();
    const org = await seedOrg();
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    const res = await callPut(org.id, { status: "ACTIVE" });
    expect(res.status).toBe(400);
  });

  it("refuse un corps non JSON (400 VALIDATION)", async () => {
    const staff = await seedStaff();
    const org = await seedOrg();
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    const { PUT } = await import("../route");
    const res = await PUT(
      new NextRequest("http://localhost/x", {
        method: "PUT",
        body: "not json",
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error?: string }).error).toBe("VALIDATION");
  });

  it("recalcule les dates lors d'une reassignation selon la periode du plan", async () => {
    const staff = await seedStaff();
    const org = await seedOrg();
    const planMonthly = await seedPlan("MONTHLY");
    const planAnnual = await seedPlan("ANNUAL");
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    await callPut(org.id, { planId: planMonthly.id, status: "ACTIVE" });
    await callPut(org.id, { planId: planAnnual.id, status: "ACTIVE" });

    const sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(sub?.planId).toBe(planAnnual.id);
    expect(Math.round((sub!.endDate!.getTime() - sub!.startDate.getTime()) / DAY_MS)).toBe(365);
  });

  it("efface le changement programmé (scheduledPlanId) lors d'une assignation staff", async () => {
    const staff = await seedStaff();
    const org = await seedOrg();
    const planA = await seedPlan("MONTHLY");
    const planB = await seedPlan("ANNUAL");
    await prisma.subscription.create({
      data: {
        orgId: org.id,
        planId: planA.id,
        status: "ACTIVE",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * DAY_MS),
        scheduledPlanId: planB.id,
      },
    });
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    const res = await callPut(org.id, { planId: planA.id, status: "ACTIVE" });
    expect(res.status).toBe(200);

    const sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(sub?.scheduledPlanId).toBeNull();
  });

  it("STAFF_OBSERVER ne peut pas assigner un abonnement (403)", async () => {
    const observer = await seedStaff("STAFF_OBSERVER");
    const org = await seedOrg();
    const plan = await seedPlan();
    withStaffSession({ id: observer.id, email: observer.email, name: observer.name });

    const res = await callPut(org.id, { planId: plan.id, status: "ACTIVE" });
    expect(res.status).toBe(403);

    const sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(sub).toBeNull();
  });

  it("404 PLAN_NOT_FOUND si le plan n'existe pas", async () => {
    const staff = await seedStaff();
    const org = await seedOrg();
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    const res = await callPut(org.id, { planId: "plan-inexistant", status: "ACTIVE" });
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("PLAN_NOT_FOUND");
  });

  it("404 si l'org n'existe pas", async () => {
    const staff = await seedStaff();
    const plan = await seedPlan();
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    const res = await callPut("org-inexistant", { planId: plan.id, status: "ACTIVE" });
    expect(res.status).toBe(404);
  });
});
