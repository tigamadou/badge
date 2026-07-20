import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

function withStaffSession(user: { id: string; email: string; name: string }) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { ...user, isStaff: true },
  } as never);
}

async function seedStaff() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return prisma.user.create({
    data: {
      email: `staff-sub-${stamp}@x.test`,
      password: "x",
      name: "S",
      emailVerifiedAt: new Date(),
      isStaff: true,
      staffRole: "STAFF_ADMIN",
    },
  });
}

async function seedOrg() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return prisma.organization.create({ data: { name: "O", slug: `o-sub-${stamp}` } });
}

async function seedPlan() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return prisma.plan.create({
    data: { name: `plan-sub-${stamp}`, maxEvents: 5, maxParticipantsPerEvent: 100 },
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

  it("assigne un abonnement mensuel et calcule endDate = +30j", async () => {
    const staff = await seedStaff();
    const org = await seedOrg();
    const plan = await seedPlan();
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    const res = await callPut(org.id, {
      planId: plan.id,
      status: "ACTIVE",
      period: "MONTHLY",
    });
    expect(res.status).toBe(200);

    const sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(sub?.period).toBe("MONTHLY");
    expect(Math.round((sub!.endDate!.getTime() - sub!.startDate.getTime()) / DAY_MS)).toBe(30);
  });

  it("assigne un abonnement annuel et calcule endDate = +365j", async () => {
    const staff = await seedStaff();
    const org = await seedOrg();
    const plan = await seedPlan();
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    const res = await callPut(org.id, {
      planId: plan.id,
      status: "ACTIVE",
      period: "ANNUAL",
    });
    expect(res.status).toBe(200);

    const sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(sub?.period).toBe("ANNUAL");
    expect(Math.round((sub!.endDate!.getTime() - sub!.startDate.getTime()) / DAY_MS)).toBe(365);
  });

  it("refuse une period manquante (400)", async () => {
    const staff = await seedStaff();
    const org = await seedOrg();
    const plan = await seedPlan();
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    const res = await callPut(org.id, { planId: plan.id, status: "ACTIVE" });
    expect(res.status).toBe(400);
  });

  it("recalcule les dates lors d'une reassignation (upsert)", async () => {
    const staff = await seedStaff();
    const org = await seedOrg();
    const plan = await seedPlan();
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    await callPut(org.id, { planId: plan.id, status: "ACTIVE", period: "MONTHLY" });
    await callPut(org.id, { planId: plan.id, status: "ACTIVE", period: "ANNUAL" });

    const sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(sub?.period).toBe("ANNUAL");
    expect(Math.round((sub!.endDate!.getTime() - sub!.startDate.getTime()) / DAY_MS)).toBe(365);
  });

  it("404 si l'org n'existe pas", async () => {
    const staff = await seedStaff();
    const plan = await seedPlan();
    withStaffSession({ id: staff.id, email: staff.email, name: staff.name });

    const res = await callPut("org-inexistant", {
      planId: plan.id,
      status: "ACTIVE",
      period: "MONTHLY",
    });
    expect(res.status).toBe(404);
  });
});
