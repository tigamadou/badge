import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { GET } from "../route";
import { prisma } from "@/lib/prisma";
import { makeOrg, makeOrgMember, makeStaff } from "@/test/factories";
import { makeBillingPayment, makeBillingPlan } from "@/test/factories-billing";

async function setup(role: "OWNER" | "MANAGER" | "AUDITOR" | "AGENT" = "MANAGER") {
  const org = await makeOrg({ name: "<b>Org</b>" });
  const user = await makeOrgMember(org.id, role);
  const plan = await makeBillingPlan();
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id } } as never);
  return { user, org, plan };
}

const call = (orgId: string, paymentId: string) =>
  GET(new Request("http://localhost/x"), { params: Promise.resolve({ orgId, paymentId }) });

describe("GET /org/[orgId]/payments/[paymentId]/receipt", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("non connecté → 401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await call("o", "p")).status).toBe(401);
  });

  it("AUDITOR, AGENT et utilisateur inconnu → 403", async () => {
    const { org, plan } = await setup("AUDITOR");
    const p = await makeBillingPayment({ orgId: org.id, planId: plan.id, amount: 1000 });
    expect((await call(org.id, p.id)).status).toBe(403);
    const agent = await makeOrgMember(org.id, "AGENT");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: agent.id } } as never);
    expect((await call(org.id, p.id)).status).toBe(403);
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "fantome" } } as never);
    expect((await call(org.id, p.id)).status).toBe(403);
  });

  it("paiement approuvé → 200 text/html no-store, contenu échappé", async () => {
    const { org, plan } = await setup("MANAGER");
    const p = await makeBillingPayment({ orgId: org.id, planId: plan.id, amount: 15000 });
    const res = await call(org.id, p.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const html = await res.text();
    expect(html).toContain("Reçu de paiement");
    expect(html).toContain("&lt;b&gt;Org&lt;/b&gt;");
    expect(html).not.toContain("<b>Org</b>");
  });

  it("Observateur plateforme (billing.payments.read) → 200", async () => {
    const { org, plan } = await setup("OWNER");
    const p = await makeBillingPayment({ orgId: org.id, planId: plan.id, amount: 1000 });
    const staff = await makeStaff("STAFF_OBSERVER");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: staff.id } } as never);
    expect((await call(org.id, p.id)).status).toBe(200);
  });

  it("paiement non approuvé, inconnu ou d'une autre organisation → 404", async () => {
    const { org, plan } = await setup("OWNER");
    const other = await makeOrg();
    const pending = await makeBillingPayment({ orgId: org.id, planId: plan.id, amount: 1, status: "PENDING" });
    const foreign = await makeBillingPayment({ orgId: other.id, planId: plan.id, amount: 1 });
    expect((await call(org.id, pending.id)).status).toBe(404);
    expect((await call(org.id, "inconnu")).status).toBe(404);
    expect((await call(org.id, foreign.id)).status).toBe(404);
  });
});
