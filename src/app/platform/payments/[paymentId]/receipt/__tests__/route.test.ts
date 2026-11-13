import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { GET } from "../route";
import { makeOrg, makeOverride, makeStaff, makeUser } from "@/test/factories";
import { makeBillingPayment, makeBillingPlan } from "@/test/factories-billing";

const call = (paymentId: string) => GET(new Request("http://localhost/x"), { params: Promise.resolve({ paymentId }) });

async function payment(status: "APPROVED" | "PENDING" = "APPROVED") {
  const org = await makeOrg();
  const plan = await makeBillingPlan();
  return makeBillingPayment({ orgId: org.id, planId: plan.id, amount: 15000, status });
}

describe("GET /platform/payments/[paymentId]/receipt", () => {
  beforeEach(() => vi.mocked(getServerSession).mockReset());

  it("non connecté → 401 ; non staff → 403", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    expect((await call("p")).status).toBe(401);
    const user = await makeUser();
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id } } as never);
    expect((await call("p")).status).toBe(403);
  });

  it("un non staff avec un ajustement GRANT payments.read reste refusé (403)", async () => {
    const user = await makeUser();
    await makeOverride({ userId: user.id, permission: "payments.read", effect: "GRANT" });
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id } } as never);
    const res = await call((await payment()).id);
    expect(res.status).toBe(403);
  });

  it("utilisateur inexistant → 401", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "fantome" } } as never);
    expect((await call("p")).status).toBe(401);
  });

  it("STAFF_OBSERVER : 200 pour un paiement approuvé, 404 sinon", async () => {
    const staff = await makeStaff("STAFF_OBSERVER");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: staff.id } } as never);
    const ok = await payment();
    const res = await call(ok.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await res.text()).toContain("Reçu de paiement");
    expect((await call((await payment("PENDING")).id)).status).toBe(404);
    expect((await call("inconnu")).status).toBe(404);
  });
});
