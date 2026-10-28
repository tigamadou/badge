import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { POST } from "@/app/api/org/[orgId]/subscription/checkout/route";

function withSession(user: { id: string; email: string; name: string }) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { ...user, isStaff: false } } as never);
}

async function seed(role: "OWNER" | "MANAGER") {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const user = await prisma.user.create({ data: { email: `c-${stamp}@x.test`, password: "x", name: "C" } });
  const org = await prisma.organization.create({ data: { name: "O", slug: `co-${stamp}` } });
  await prisma.orgMembership.create({ data: { userId: user.id, orgId: org.id, role } });
  const plan = await prisma.plan.create({ data: { name: "pro", price: 15000 } });
  withSession(user);
  return { user, org, plan };
}

function call(orgId: string, body: unknown) {
  const req = new NextRequest(`http://localhost/api/org/${orgId}/subscription/checkout`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ orgId }) });
}

describe("POST /api/org/[orgId]/subscription/checkout", () => {
  beforeEach(async () => {
    vi.mocked(getServerSession).mockReset();
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_test");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "whsec");
    process.env.NEXTAUTH_URL = "https://badge.local";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("non connecté → 401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await call("x", { planId: "p" })).status).toBe(401);
  });

  it("MANAGER → 403", async () => {
    const { org, plan } = await seed("MANAGER");
    expect((await call(org.id, { planId: plan.id })).status).toBe(403);
  });

  it("OWNER → 200 { url }", async () => {
    const { org, plan } = await seed("OWNER");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ "v1/transaction": { id: 5, reference: "r", amount: 15000, status: "pending" } })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ "v1/token": { url: "https://pay.fedapay.com/t" } })));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(org.id, { planId: plan.id });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://pay.fedapay.com/t" });
  });

  it("body invalide → 400", async () => {
    const { org } = await seed("OWNER");
    expect((await call(org.id, { planId: "" })).status).toBe(400);
    expect((await call(org.id, "pas du json")).status).toBe(400);
  });

  it("PaymentError → son httpStatus", async () => {
    const { org } = await seed("OWNER");
    const res = await call(org.id, { planId: "inconnu" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "PLAN_NOT_FOR_SALE" });
  });

  it("erreur inattendue (org inexistante, accès staff) → propagée", async () => {
    const staff = await prisma.user.create({
      data: { email: `st-${Date.now()}@x.test`, password: "x", name: "S", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    withSession(staff);
    const plan = await prisma.plan.create({ data: { name: "pro", price: 15000 } });
    await expect(call("org-fantome", { planId: plan.id })).rejects.toThrow();
  });
});
