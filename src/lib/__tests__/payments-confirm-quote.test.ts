import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { confirmPayment } from "@/lib/payments";
import { makeOrg, makeUser, seedFactories } from "@/test/factories";
import { makeBillingPayment, makeBillingPlan, makeSubscription } from "@/test/factories-billing";

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY);

let nextTx = 40_000;
const newTx = () => nextTx++;

function tx(id: number, amount: number, status = "approved", currency = "XOF") {
  return new Response(
    JSON.stringify({ "v1/transaction": { id, reference: `trx_${id}`, amount, status, currency: { iso: currency } } }),
  );
}

async function setup(current: { price: number; endInDays: number | null } | null = null) {
  const user = await makeUser();
  const org = await makeOrg();
  const cheap = await makeBillingPlan({ price: 30000 });
  const dear = await makeBillingPlan({ price: 45000 });
  const lower = await makeBillingPlan({ price: 10000 });
  const sub = current
    ? await makeSubscription(org.id, current.price === 30000 ? cheap.id : dear.id, {
        startDate: inDays(-15),
        endDate: current.endInDays === null ? null : inDays(current.endInDays),
      })
    : null;
  return { user, org, cheap, dear, lower, sub };
}

describe("confirmPayment : montant figé, périodes couvertes", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeAll(() => seedFactories(4401));
  beforeEach(() => {
    vi.stubEnv("FEDAPAY_ENVIRONMENT", "sandbox");
    vi.stubEnv("FEDAPAY_SECRET_KEY", "sk_test");
    vi.stubEnv("FEDAPAY_WEBHOOK_SECRET", "whsec");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const pending = (orgId: string, planId: string, amount: number, id: number, extra: object = {}) =>
    makeBillingPayment({
      orgId, planId, amount, status: "PENDING", fedapayTransactionId: id, listPrice: amount, prorataCredit: 0, ...extra,
    });

  it("IMMEDIATE : coversFrom/coversTo = nouvelle période", async () => {
    const { org, user, cheap } = await setup(null);
    const id = newTx();
    const p = await pending(org.id, cheap.id, 30000, id, { userId: user.id });
    fetchMock.mockResolvedValue(tx(id, 30000));
    await confirmPayment(id);
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } });
    expect(row.mode).toBe("IMMEDIATE");
    expect(row.coversFrom!.getTime()).toBe(sub.startDate.getTime());
    expect(row.coversTo!.getTime()).toBe(sub.endDate!.getTime());
    expect(row.coversTo!.getTime() - row.coversFrom!.getTime()).toBe(30 * DAY);
  });

  it("paiement hérité sans prix plein : montée en gamme appliquée, sans écart de crédit", async () => {
    const { org, dear } = await setup({ price: 30000, endInDays: 15 });
    const id = newTx();
    const p = await pending(org.id, dear.id, 45000, id, { listPrice: null });
    fetchMock.mockResolvedValue(tx(id, 45000));
    await confirmPayment(id);
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.mode).toBe("IMMEDIATE");
    expect(await prisma.activityLog.count({ where: { type: "PAYMENT_PRORATA_MISMATCH", orgId: org.id } })).toBe(0);
  });

  it("paiement hérité sans crédit enregistré : traité comme un crédit nul", async () => {
    const { org, dear } = await setup({ price: 30000, endInDays: 15 });
    const id = newTx();
    const p = await pending(org.id, dear.id, 45000, id, { prorataCredit: null });
    fetchMock.mockResolvedValue(tx(id, 45000));
    await confirmPayment(id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).mode).toBe("IMMEDIATE");
    expect(await prisma.activityLog.count({ where: { type: "PAYMENT_PRORATA_MISMATCH", orgId: org.id } })).toBe(0);
  });

  it("EXTENSION : de l'ancienne à la nouvelle échéance", async () => {
    const { org, cheap, sub } = await setup({ price: 30000, endInDays: 5 });
    const id = newTx();
    const p = await pending(org.id, cheap.id, 30000, id);
    fetchMock.mockResolvedValue(tx(id, 30000));
    await confirmPayment(id);
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.mode).toBe("EXTENSION");
    expect(row.coversFrom!.getTime()).toBe(sub!.endDate!.getTime());
    expect(row.coversTo!.getTime()).toBe(sub!.endDate!.getTime() + 30 * DAY);
  });

  it("SCHEDULED : de l'échéance à l'échéance plus la période du plan programmé", async () => {
    const { org, lower, sub } = await setup({ price: 30000, endInDays: 5 });
    const id = newTx();
    const p = await pending(org.id, lower.id, 10000, id);
    fetchMock.mockResolvedValue(tx(id, 10000));
    await confirmPayment(id);
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.mode).toBe("SCHEDULED");
    expect(row.coversFrom!.getTime()).toBe(sub!.endDate!.getTime());
    expect(row.coversTo!.getTime()).toBe(sub!.endDate!.getTime() + 30 * DAY);
  });

  it("compare sur le prix plein, pas sur le montant payé", async () => {
    const { org, dear } = await setup({ price: 30000, endInDays: 15 });
    const id = newTx();
    // Montée en gamme payée 25 000 (< 30 000, prix du plan courant) pour un prix plein de 45 000.
    const p = await pending(org.id, dear.id, 25000, id, { listPrice: 45000, prorataCredit: 20000 });
    fetchMock.mockResolvedValue(tx(id, 25000));
    await confirmPayment(id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).mode).toBe("IMMEDIATE");
    expect((await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } })).planId).toBe(dear.id);
  });

  it("applique au montant figé, trace creditDrift et PAYMENT_PRORATA_MISMATCH", async () => {
    const { org, user, dear, cheap } = await setup({ price: 30000, endInDays: 15 });
    // Crédit actuel : 30 000 payés sur 30 j, la moitié restante = ~15 000 ; figé à 20 000 à la création.
    await makeBillingPayment({ orgId: org.id, planId: cheap.id, amount: 30000, coversFrom: inDays(-15), coversTo: inDays(15) });
    const id = newTx();
    const p = await pending(org.id, dear.id, 25000, id, { listPrice: 45000, prorataCredit: 20000, userId: user.id });
    fetchMock.mockResolvedValue(tx(id, 25000));
    const res = await confirmPayment(id);
    expect(res).toEqual({ status: "APPROVED", applied: true });
    const approved = await prisma.activityLog.findFirstOrThrow({ where: { type: "PAYMENT_APPROVED", targetId: p.id } });
    expect(approved.details).toMatchObject({ listPrice: 45000, prorataCredit: 20000, creditDrift: { frozen: 20000 } });
    const drift = (approved.details as { creditDrift: { current: number } }).creditDrift.current;
    expect(drift).toBeGreaterThanOrEqual(14999);
    expect(drift).toBeLessThanOrEqual(15000);
    const mismatch = await prisma.activityLog.findFirstOrThrow({ where: { type: "PAYMENT_PRORATA_MISMATCH", targetId: p.id } });
    expect(mismatch.details).toMatchObject({ frozen: 20000, current: drift });
    const sub = await prisma.activityLog.findFirstOrThrow({ where: { type: "SUBSCRIPTION_UPDATED", orgId: org.id } });
    expect(sub.details).toMatchObject({ creditDrift: { frozen: 20000 } });
  });

  it("pas d'écart quand le crédit recalculé est celui qui est figé", async () => {
    const { org, dear } = await setup({ price: 30000, endInDays: 15 });
    const id = newTx();
    const p = await pending(org.id, dear.id, 45000, id, { listPrice: 45000, prorataCredit: 0 });
    fetchMock.mockResolvedValue(tx(id, 45000));
    await confirmPayment(id);
    expect(await prisma.activityLog.count({ where: { type: "PAYMENT_PRORATA_MISMATCH", targetId: p.id } })).toBe(0);
    const approved = await prisma.activityLog.findFirstOrThrow({ where: { type: "PAYMENT_APPROVED", targetId: p.id } });
    expect(approved.details).not.toHaveProperty("creditDrift");
  });

  it("refuse un montant FedaPay différent du montant figé", async () => {
    const { org, dear } = await setup({ price: 30000, endInDays: 15 });
    const id = newTx();
    const p = await pending(org.id, dear.id, 25000, id, { listPrice: 45000, prorataCredit: 20000 });
    fetchMock.mockResolvedValue(tx(id, 45000));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await confirmPayment(id);
    expect(res).toEqual({ status: "DECLINED", applied: false });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("DECLINED");
  });

  it("un PENDING remplacé (CANCELED) puis payé chez FedaPay est appliqué", async () => {
    const { org, cheap } = await setup(null);
    const id = newTx();
    const p = await pending(org.id, cheap.id, 30000, id, { status: "CANCELED" });
    fetchMock.mockResolvedValue(tx(id, 30000));
    expect(await confirmPayment(id)).toEqual({ status: "APPROVED", applied: true });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("APPROVED");
    expect((await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } })).planId).toBe(cheap.id);
  });

  it("un CANCELED non approuvé reste sans effet", async () => {
    const { org, cheap } = await setup(null);
    const id = newTx();
    const p = await pending(org.id, cheap.id, 30000, id, { status: "CANCELED" });
    fetchMock.mockResolvedValue(tx(id, 30000, "declined"));
    expect(await confirmPayment(id)).toEqual({ status: "CANCELED", applied: false });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("CANCELED");
    expect(await prisma.subscription.count({ where: { orgId: org.id } })).toBe(0);
  });

  it("deux confirmations concurrentes n'appliquent qu'une fois", async () => {
    const { org, cheap } = await setup(null);
    const id = newTx();
    await pending(org.id, cheap.id, 30000, id);
    fetchMock.mockImplementation(async () => tx(id, 30000));
    const results = await Promise.all([confirmPayment(id), confirmPayment(id)]);
    expect(results.filter((r) => r?.applied)).toHaveLength(1);
    expect(await prisma.activityLog.count({ where: { type: "SUBSCRIPTION_UPDATED", orgId: org.id } })).toBe(1);
  });

  it("deux paiements du même plan s'additionnent", async () => {
    const { org, cheap } = await setup(null);
    const [a, b] = [newTx(), newTx()];
    await pending(org.id, cheap.id, 30000, a);
    await pending(org.id, cheap.id, 30000, b);
    fetchMock.mockImplementation(async (url: string) => {
      const id = Number(new URL(url).pathname.split("/").pop());
      return tx(id, 30000);
    });
    await confirmPayment(a);
    await confirmPayment(b);
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { orgId: org.id } });
    expect(sub.endDate!.getTime() - sub.startDate.getTime()).toBe(60 * DAY);
  });

  it("un plan programmé est annulé par une montée en gamme et conservé par une extension", async () => {
    const { org, cheap, dear, lower, sub } = await setup({ price: 30000, endInDays: 15 });
    await prisma.subscription.update({ where: { id: sub!.id }, data: { scheduledPlanId: lower.id } });

    const ext = newTx();
    await pending(org.id, cheap.id, 30000, ext);
    fetchMock.mockResolvedValue(tx(ext, 30000));
    await confirmPayment(ext);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub!.id } })).scheduledPlanId).toBe(lower.id);

    const up = newTx();
    await pending(org.id, dear.id, 45000, up);
    fetchMock.mockResolvedValue(tx(up, 45000));
    await confirmPayment(up);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub!.id } })).scheduledPlanId).toBeNull();
  });

  it("un paiement sans prix plein (ancien) garde amount comme prix de comparaison", async () => {
    const { org, dear } = await setup({ price: 30000, endInDays: 15 });
    const id = newTx();
    const p = await makeBillingPayment({ orgId: org.id, planId: dear.id, amount: 45000, status: "PENDING", fedapayTransactionId: id });
    fetchMock.mockResolvedValue(tx(id, 45000));
    await confirmPayment(id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).mode).toBe("IMMEDIATE");
    expect(await prisma.activityLog.count({ where: { type: "PAYMENT_PRORATA_MISMATCH", targetId: p.id } })).toBe(0);
  });
});
