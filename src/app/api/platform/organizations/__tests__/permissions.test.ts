// Refus par permission : le rôle sans la clé reçoit 403 et la base reste inchangée.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeOrg, makePlan, makeStaff } from "@/test/factories";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

type Key = Parameters<typeof makeStaff>[0];

async function as(role: Key) {
  const u = await makeStaff(role);
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: u.id, isStaff: true } } as never);
  return u;
}

const req = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/x", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("organisations, abonnements et plans : refus par permission", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("STAFF_SUPPORT ne crée pas d'organisation (organizations.create)", async () => {
    await as("STAFF_SUPPORT");
    const { POST } = await import("@/app/api/platform/organizations/route");
    const res = await POST(
      req("POST", { name: "Org X", ownerEmail: "owner@x.test", ownerName: "O" }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "PERMISSION_DENIED" });
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.user.count({ where: { email: "owner@x.test" } })).toBe(0);
  });

  it("l'Observateur ne modifie pas, n'archive pas et n'abonne pas une organisation", async () => {
    const org = await makeOrg({ name: "Avant" });
    await as("STAFF_OBSERVER");
    const params = { params: Promise.resolve({ orgId: org.id }) };
    const detail = await import("@/app/api/platform/organizations/[orgId]/route");
    const archive = await import("@/app/api/platform/organizations/[orgId]/archive/route");
    const restore = await import("@/app/api/platform/organizations/[orgId]/restore/route");
    const subscription = await import("@/app/api/platform/organizations/[orgId]/subscription/route");

    expect((await detail.PATCH(req("PATCH", { name: "Après" }), params)).status).toBe(403);
    expect((await archive.POST(req("POST"), params)).status).toBe(403);
    expect((await restore.POST(req("POST"), params)).status).toBe(403);
    expect((await subscription.PUT(req("PUT", { planId: "x" }), params)).status).toBe(403);
    expect((await detail.DELETE(req("DELETE"), params)).status).toBe(403);

    const after = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(after).toMatchObject({ name: "Avant", archived: false });
    expect(await prisma.subscription.count({ where: { orgId: org.id } })).toBe(0);
  });

  it("STAFF_ADMIN archive mais ne supprime pas définitivement (organizations.delete)", async () => {
    const org = await makeOrg();
    await as("STAFF_ADMIN");
    const params = { params: Promise.resolve({ orgId: org.id }) };
    const detail = await import("@/app/api/platform/organizations/[orgId]/route");
    expect((await detail.DELETE(req("DELETE"), params)).status).toBe(403);
    expect(await prisma.organization.count({ where: { id: org.id } })).toBe(1);
  });

  it("l'Observateur et le Support ne gèrent pas les plans (plans.manage)", async () => {
    const plan = await makePlan({ name: "Plan A" });
    const plans = await import("@/app/api/platform/plans/route");
    const one = await import("@/app/api/platform/plans/[planId]/route");
    for (const role of ["STAFF_OBSERVER", "STAFF_SUPPORT"] as const) {
      await as(role);
      expect((await plans.POST(req("POST", { name: "Nouveau" }), { params: Promise.resolve({}) })).status).toBe(403);
      expect(
        (await one.PATCH(req("PATCH", { name: "Renommé" }), { params: Promise.resolve({ planId: plan.id }) })).status,
      ).toBe(403);
    }
    expect(await prisma.plan.count()).toBe(1);
    expect((await prisma.plan.findUnique({ where: { id: plan.id } }))?.name).toBe("Plan A");
  });

  it("l'Imprimeur ne lit ni les organisations ni les plans", async () => {
    await as("STAFF_PRINTER");
    const orgs = await import("@/app/api/platform/organizations/route");
    const plans = await import("@/app/api/platform/plans/route");
    expect((await orgs.GET(req("GET"), { params: Promise.resolve({}) })).status).toBe(403);
    expect((await plans.GET(req("GET"), { params: Promise.resolve({}) })).status).toBe(403);
  });
});
