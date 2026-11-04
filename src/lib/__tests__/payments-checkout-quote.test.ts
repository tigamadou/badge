import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { PaymentError, startCheckout } from "@/lib/payments";
import { makeOrg, makeUser, seedFactories } from "@/test/factories";
import { makeBillingPayment, makeBillingPlan, makeSubscription } from "@/test/factories-billing";

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY);

let nextTx = 5000;
// Simule FedaPay : creation de transaction, jeton de paiement, relecture (statut configurable).
function mockFedapay(fetchMock: ReturnType<typeof vi.fn>, opts: { status?: string; known?: boolean } = {}) {
  fetchMock.mockImplementation(async (url: string, init?: { method?: string; body?: string }) => {
    const path = new URL(url).pathname;
    if (init?.method === "POST" && path.endsWith("/transactions")) {
      const body = JSON.parse(init.body as string);
      const id = nextTx++;
      return new Response(
        JSON.stringify({ "v1/transaction": { id, reference: `trx_${id}`, amount: body.amount, status: "pending", currency: { iso: "XOF" } } }),
      );
    }
    if (init?.method === "POST" && path.endsWith("/token")) {
      return new Response(JSON.stringify({ "v1/token": { url: "https://pay.fedapay.com/t" } }));
    }
    if (opts.known === false) return new Response("{}", { status: 404 });
    const id = Number(path.split("/").pop());
    return new Response(
      JSON.stringify({ "v1/transaction": { id, reference: `trx_${id}`, amount: 1, status: opts.status ?? "pending", currency: { iso: "XOF" } } }),
    );
  });
}

async function setup(opts: { current?: "basic" | "pro" | null; endInDays?: number | null } = {}) {
  const user = await makeUser();
  const org = await makeOrg();
  const basic = await makeBillingPlan({ price: 5000 });
  const pro = await makeBillingPlan({ price: 15000 });
  const business = await makeBillingPlan({ price: 45000 });
  const current = opts.current === undefined ? "pro" : opts.current;
  const plan = current === "basic" ? basic : current === "pro" ? pro : null;
  const sub = plan
    ? await makeSubscription(org.id, plan.id, {
        startDate: inDays(-15),
        endDate: opts.endInDays === null ? null : inDays(opts.endInDays ?? 15),
      })
    : null;
  return { user, org, basic, pro, business, sub };
}

describe("startCheckout : devis", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeAll(() => seedFactories(3301));
  beforeEach(() => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "sandbox");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_test");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "whsec");
    process.env.NEXTAUTH_URL = "https://badge.local/";
    fetchMock = vi.fn();
    mockFedapay(fetchMock);
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const pendingCount = (orgId: string) => prisma.payment.count({ where: { orgId, status: "PENDING" } });

  it("refuse le même plan hors fenêtre", async () => {
    const { user, org, pro, sub } = await setup({ current: "pro", endInDays: 20 });
    const error = await startCheckout({ orgId: org.id, planId: pro.id, userId: user.id }).catch((e) => e);
    expect(error).toBeInstanceOf(PaymentError);
    expect(error.code).toBe("ALREADY_ACTIVE");
    expect(error.detail.renewableFrom.getTime()).toBe(sub!.endDate!.getTime() - 7 * DAY);
    expect(error.detail.activeUntil.getTime()).toBe(sub!.endDate!.getTime());
    expect(await prisma.payment.count({ where: { orgId: org.id } })).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepte le renouvellement à J-7 et conserve un plan programmé", async () => {
    const { user, org, pro, basic, sub } = await setup({ current: "pro", endInDays: 6 });
    await prisma.subscription.update({ where: { id: sub!.id }, data: { scheduledPlanId: basic.id } });
    const res = await startCheckout({ orgId: org.id, planId: pro.id, userId: user.id });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: res.paymentId } });
    expect(payment).toMatchObject({ amount: 15000, prorataCredit: 0, listPrice: 15000, status: "PENDING" });
    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub!.id } });
    expect(after.scheduledPlanId).toBe(basic.id);
    expect(after.endDate!.getTime()).toBe(sub!.endDate!.getTime());
  });

  it("accepte la montée en gamme avec un plan programmé", async () => {
    const { user, org, pro, basic, sub } = await setup({ current: "basic", endInDays: 15 });
    await prisma.subscription.update({ where: { id: sub!.id }, data: { scheduledPlanId: basic.id } });
    await makeBillingPayment({
      orgId: org.id, planId: basic.id, amount: 5000, coversFrom: inDays(-15), coversTo: inDays(15),
    });
    const res = await startCheckout({ orgId: org.id, planId: pro.id, userId: user.id });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: res.paymentId } });
    expect(payment.listPrice).toBe(15000);
    expect(payment.prorataCredit).toBeGreaterThanOrEqual(2499);
    expect(payment.prorataCredit).toBeLessThanOrEqual(2500);
    expect(payment.amount).toBe(15000 - payment.prorataCredit!);
    const created = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith("/transactions") && i?.method === "POST")!;
    expect(JSON.parse(created[1].body).amount).toBe(payment.amount);
  });

  it("refuse un second changement programmé", async () => {
    const { user, org, basic, sub } = await setup({ current: "pro", endInDays: 15 });
    await prisma.subscription.update({ where: { id: sub!.id }, data: { scheduledPlanId: basic.id } });
    await expect(startCheckout({ orgId: org.id, planId: basic.id, userId: user.id })).rejects.toMatchObject({
      code: "CHANGE_ALREADY_SCHEDULED",
    });
  });

  it("période offerte par le staff : aucun crédit", async () => {
    const { user, org, basic, pro } = await setup({ current: "basic", endInDays: 15 });
    await makeBillingPayment({ orgId: org.id, planId: basic.id, amount: 5000 });
    const res = await startCheckout({ orgId: org.id, planId: pro.id, userId: user.id });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: res.paymentId } });
    expect(payment).toMatchObject({ prorataCredit: 0, amount: 15000, listPrice: 15000 });
  });

  it("crédit supérieur au prix : NOTHING_TO_PAY", async () => {
    const { user, org, basic, pro } = await setup({ current: "basic", endInDays: 15 });
    await makeBillingPayment({
      orgId: org.id, planId: basic.id, amount: 60000, coversFrom: inDays(-1), coversTo: inDays(29),
    });
    await expect(startCheckout({ orgId: org.id, planId: pro.id, userId: user.id })).rejects.toMatchObject({
      code: "NOTHING_TO_PAY",
      httpStatus: 409,
    });
    expect(await prisma.payment.count({ where: { orgId: org.id, status: "PENDING" } })).toBe(0);
  });

  it("abonnement échu mais ACTIVE : IMMEDIATE sans crédit", async () => {
    const { user, org, pro, business } = await setup({ current: "pro", endInDays: -1 });
    await makeBillingPayment({
      orgId: org.id, planId: pro.id, amount: 15000, coversFrom: inDays(-31), coversTo: inDays(-1),
    });
    const same = await startCheckout({ orgId: org.id, planId: pro.id, userId: user.id });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: same.paymentId } })).toMatchObject({
      amount: 15000, prorataCredit: 0,
    });
    // second plan : le PENDING du premier est remplace
    const up = await startCheckout({ orgId: org.id, planId: business.id, userId: user.id });
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: up.paymentId } })).toMatchObject({
      amount: 45000, prorataCredit: 0,
    });
  });

  it("un seul PENDING par organisation", async () => {
    const { user, org, pro } = await setup({ current: null });
    const results = await Promise.allSettled([
      startCheckout({ orgId: org.id, planId: pro.id, userId: user.id }),
      startCheckout({ orgId: org.id, planId: pro.id, userId: user.id }),
    ]);
    expect(await pendingCount(org.id)).toBe(1);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "PAYMENT_IN_PROGRESS" });
    }
  });

  it("réutilise un PENDING du même plan de moins de 30 min", async () => {
    const { user, org, pro } = await setup({ current: null });
    const first = await startCheckout({ orgId: org.id, planId: pro.id, userId: user.id });
    const txCalls = () => fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith("/transactions") && i?.method === "POST").length;
    expect(txCalls()).toBe(1);
    const again = await startCheckout({ orgId: org.id, planId: pro.id, userId: user.id });
    expect(again.paymentId).toBe(first.paymentId);
    expect(again.url).toBe("https://pay.fedapay.com/t");
    expect(txCalls()).toBe(1);
    expect(await pendingCount(org.id)).toBe(1);
  });

  it("remplace un PENDING d'un autre plan ou de plus de 30 min", async () => {
    const { user, org, pro, business } = await setup({ current: null });
    const first = await startCheckout({ orgId: org.id, planId: pro.id, userId: user.id });
    const other = await startCheckout({ orgId: org.id, planId: business.id, userId: user.id });
    expect(other.paymentId).not.toBe(first.paymentId);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: first.paymentId } })).status).toBe("CANCELED");
    expect(await pendingCount(org.id)).toBe(1);

    await prisma.payment.update({ where: { id: other.paymentId }, data: { createdAt: new Date(Date.now() - 31 * 60 * 1000) } });
    const later = await startCheckout({ orgId: org.id, planId: business.id, userId: user.id });
    expect(later.paymentId).not.toBe(other.paymentId);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: other.paymentId } })).status).toBe("CANCELED");
    expect(await pendingCount(org.id)).toBe(1);
  });

  it("PENDING sans transaction de moins de 2 min : PAYMENT_IN_PROGRESS ; plus ancien : remplacé", async () => {
    const { user, org, pro } = await setup({ current: null });
    const stuck = await makeBillingPayment({ orgId: org.id, planId: pro.id, amount: 15000, status: "PENDING" });
    await expect(startCheckout({ orgId: org.id, planId: pro.id, userId: user.id })).rejects.toMatchObject({
      code: "PAYMENT_IN_PROGRESS",
    });
    await prisma.payment.update({ where: { id: stuck.id }, data: { createdAt: new Date(Date.now() - 3 * 60 * 1000) } });
    const res = await startCheckout({ orgId: org.id, planId: pro.id, userId: user.id });
    expect(res.paymentId).not.toBe(stuck.id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: stuck.id } })).status).toBe("CANCELED");
  });

  it("un candidat inconnu de FedaPay est remplacé", async () => {
    const { user, org, pro } = await setup({ current: null });
    const old = await makeBillingPayment({
      orgId: org.id, planId: pro.id, amount: 15000, status: "PENDING", fedapayTransactionId: 777,
    });
    mockFedapay(fetchMock, { known: false });
    const res = await startCheckout({ orgId: org.id, planId: pro.id, userId: user.id });
    expect(res.paymentId).not.toBe(old.id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("CANCELED");
  });

  it("la reprise n'a lieu qu'une fois : deux candidats refusés de suite donnent PAYMENT_IN_PROGRESS", async () => {
    const { user, org, pro } = await setup({ current: null });
    const first = await makeBillingPayment({
      orgId: org.id, planId: pro.id, amount: 15000, status: "PENDING", fedapayTransactionId: 880,
      createdAt: new Date(Date.now() - 2000),
    });
    const second = await makeBillingPayment({
      orgId: org.id, planId: pro.id, amount: 15000, status: "PENDING", fedapayTransactionId: 881,
    });
    mockFedapay(fetchMock, { status: "declined" });
    await expect(startCheckout({ orgId: org.id, planId: pro.id, userId: user.id })).rejects.toMatchObject({
      code: "PAYMENT_IN_PROGRESS",
    });
    for (const id of [first.id, second.id]) {
      expect((await prisma.payment.findUniqueOrThrow({ where: { id } })).status).toBe("DECLINED");
    }
  });

  it("un candidat déjà payé chez FedaPay est confirmé puis le devis refait (ALREADY_ACTIVE)", async () => {
    const { user, org, pro } = await setup({ current: null });
    await makeBillingPayment({
      orgId: org.id, planId: pro.id, amount: 15000, status: "PENDING", fedapayTransactionId: 778,
    });
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ "v1/transaction": { id: 778, reference: "trx_778", amount: 15000, status: "approved", currency: { iso: "XOF" } } })),
    );
    await expect(startCheckout({ orgId: org.id, planId: pro.id, userId: user.id })).rejects.toMatchObject({
      code: "ALREADY_ACTIVE",
    });
    expect((await prisma.payment.findUniqueOrThrow({ where: { fedapayTransactionId: 778 } })).status).toBe("APPROVED");
  });

  it("journalise le prix plein et le crédit", async () => {
    const { user, org, basic, pro } = await setup({ current: "basic", endInDays: 15 });
    await makeBillingPayment({ orgId: org.id, planId: basic.id, amount: 5000, coversFrom: inDays(-15), coversTo: inDays(15) });
    const res = await startCheckout({ orgId: org.id, planId: pro.id, userId: user.id });
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "PAYMENT_INITIATED", targetId: res.paymentId } });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: res.paymentId } });
    expect(log.details).toMatchObject({
      paymentId: res.paymentId, planId: pro.id, listPrice: 15000, prorataCredit: payment.prorataCredit, amount: payment.amount,
    });
  });
});
