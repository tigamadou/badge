import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { makeStaff } from "@/test/factories";
import { makeBillingPayment, makeSubscription } from "@/test/factories-billing";
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

  it("SUPER_ADMIN non membre → 403 (le paiement reste côté organisateur)", async () => {
    const { org, plan } = await seed("OWNER");
    const staff = await makeStaff("SUPER_ADMIN");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: staff.id, email: staff.email, name: "S", isStaff: true } } as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(org.id, { planId: plan.id });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "PERMISSION_DENIED" });
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("même plan hors fenêtre → 409 ALREADY_ACTIVE avec les dates ISO", async () => {
    const { org, plan } = await seed("OWNER");
    const endDate = new Date(Date.now() + 20 * 86400000);
    await makeSubscription(org.id, plan.id, { endDate });
    const res = await call(org.id, { planId: plan.id });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "ALREADY_ACTIVE",
      activeUntil: endDate.toISOString(),
      renewableFrom: new Date(endDate.getTime() - 7 * 86400000).toISOString(),
    });
  });

  it("abonnement sans échéance, même plan → 409 ALREADY_ACTIVE sans dates", async () => {
    const { org, plan } = await seed("OWNER");
    await makeSubscription(org.id, plan.id, { endDate: null });
    const res = await call(org.id, { planId: plan.id });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "ALREADY_ACTIVE", activeUntil: null, renewableFrom: null });
  });

  it("crédit supérieur au prix → 409 NOTHING_TO_PAY", async () => {
    const { org, plan } = await seed("OWNER");
    const cheap = await prisma.plan.create({ data: { name: "cheap", price: 5000 } });
    await makeSubscription(org.id, cheap.id, { endDate: new Date(Date.now() + 20 * 86400000) });
    await makeBillingPayment({
      orgId: org.id, planId: cheap.id, amount: 60000,
      coversFrom: new Date(Date.now() - 86400000), coversTo: new Date(Date.now() + 29 * 86400000),
    });
    const res = await call(org.id, { planId: plan.id });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "NOTHING_TO_PAY" });
  });

  it("erreur inattendue (prisma indisponible) → propagée", async () => {
    const { org, plan } = await seed("OWNER");
    const spy = vi.spyOn(prisma.plan, "findUnique").mockRejectedValueOnce(new Error("boom"));
    await expect(call(org.id, { planId: plan.id })).rejects.toThrow("boom");
    spy.mockRestore();
  });
});
