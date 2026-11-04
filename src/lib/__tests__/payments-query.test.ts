import { beforeAll, describe, expect, it } from "vitest";
import { makeEvent, makeOrg, makePrintOrder, makeUser, seedFactories } from "@/test/factories";
import { makeBillingPayment, makeBillingPlan, makePrintPayment } from "@/test/factories-billing";
import { listPayments, loadPayment, parsePaymentFilters, paymentWhere } from "@/lib/payments-query";
import { prisma } from "@/lib/prisma";

describe("parsePaymentFilters", () => {
  const opts = { allowOrg: false };

  it("retient un statut et un type valides, ignore les autres", () => {
    expect(parsePaymentFilters({ status: "APPROVED", purpose: "PRINT_REQUEST" }, opts)).toEqual({
      status: "APPROVED",
      purpose: "PRINT_REQUEST",
    });
    expect(parsePaymentFilters({ status: "nimporte", purpose: "x" }, opts)).toEqual({});
  });

  it("borne la période au jour entier en UTC", () => {
    const f = parsePaymentFilters({ from: "2026-11-01", to: "2026-11-30" }, opts);
    expect(f.from?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(f.to?.toISOString()).toBe("2026-11-30T23:59:59.999Z");
  });

  it("ignore les dates invalides ou une période inversée", () => {
    expect(parsePaymentFilters({ from: "2026-02-31", to: "hier" }, opts)).toEqual({});
    expect(parsePaymentFilters({ from: "2026-11-30", to: "2026-11-01" }, opts)).toEqual({});
    expect(parsePaymentFilters({ from: "2026-13-01" }, opts)).toEqual({});
  });

  it("coupe et trime la recherche, ignore la recherche vide", () => {
    expect(parsePaymentFilters({ q: `  ${"a".repeat(80)}  ` }, opts).q).toBe("a".repeat(64));
    expect(parsePaymentFilters({ q: "   " }, opts)).toEqual({});
    expect(parsePaymentFilters({ q: `${"a".repeat(63)} b` }, opts).q).toBe("a".repeat(63));
  });

  it("orgId n'est lu qu'avec allowOrg", () => {
    expect(parsePaymentFilters({ orgId: "o1" }, { allowOrg: false })).toEqual({});
    expect(parsePaymentFilters({ orgId: " o1 " }, { allowOrg: true })).toEqual({ orgId: "o1" });
    expect(parsePaymentFilters({ orgId: "" }, { allowOrg: true })).toEqual({});
    expect(parsePaymentFilters({ orgQuery: "  alpha  " }, { allowOrg: true })).toEqual({ orgQuery: "alpha" });
    expect(parsePaymentFilters({ orgQuery: "alpha" }, { allowOrg: false })).toEqual({});
    expect(parsePaymentFilters({ orgQuery: "   " }, { allowOrg: true })).toEqual({});
  });

  it("prend la première valeur d'un tableau", () => {
    expect(parsePaymentFilters({ status: ["DECLINED", "APPROVED"] }, opts)).toEqual({ status: "DECLINED" });
  });
});

describe("paymentWhere", () => {
  it("impose toujours le scope d'organisation", () => {
    expect(paymentWhere({ orgId: "autre" }, { orgId: "o1" })).toEqual({ orgId: "o1" });
    expect(paymentWhere({ orgId: "autre" }, {})).toEqual({ orgId: "autre" });
    expect(paymentWhere({}, {})).toEqual({});
  });

  it("orgQuery cherche dans le nom et le slug, sauf avec un scope d'organisation", () => {
    expect(paymentWhere({ orgQuery: "alp" }, {})).toEqual({
      org: { OR: [{ name: { contains: "alp" } }, { slug: { contains: "alp" } }] },
    });
    expect(paymentWhere({ orgQuery: "alp" }, { orgId: "o1" })).toEqual({ orgId: "o1" });
  });

  it("traduit statut, type, période et référence", () => {
    const from = new Date("2026-11-01T00:00:00Z");
    const to = new Date("2026-11-30T23:59:59.999Z");
    expect(paymentWhere({ status: "APPROVED", purpose: "SUBSCRIPTION", from, to, q: "trx_1" }, {})).toEqual({
      status: "APPROVED",
      purpose: "SUBSCRIPTION",
      createdAt: { gte: from, lte: to },
      fedapayReference: { contains: "trx_1" },
    });
    expect(paymentWhere({ from }, {})).toEqual({ createdAt: { gte: from } });
    expect(paymentWhere({ to }, {})).toEqual({ createdAt: { lte: to } });
  });
});

describe("listPayments / loadPayment", () => {
  beforeAll(() => seedFactories(6601));

  async function setup() {
    const org = await makeOrg();
    const other = await makeOrg();
    const plan = await makeBillingPlan();
    const user = await makeUser();
    return { org, other, plan, user };
  }

  it("ordre stable, total indépendant de la page, label du plan", async () => {
    const { org, plan } = await setup();
    const base = new Date("2026-10-01T10:00:00Z").getTime();
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      ids.push((await makeBillingPayment({ orgId: org.id, planId: plan.id, amount: 1000 + i, createdAt: new Date(base + i * 1000) })).id);
    }
    const first = await listPayments({}, { orgId: org.id }, { skip: 0, take: 2 });
    expect(first.total).toBe(5);
    expect(first.items.map((p) => p.id)).toEqual([ids[4], ids[3]]);
    expect(first.items[0].label).toBe(plan.name);
    expect(first.items[0].orgName).toBe(org.name);
    const last = await listPayments({}, { orgId: org.id }, { skip: 4, take: 2 });
    expect(last.items.map((p) => p.id)).toEqual([ids[0]]);
    expect(last.total).toBe(5);
  });

  it("ordre secondaire par id à date égale", async () => {
    const { org, plan } = await setup();
    const at = new Date("2026-10-02T10:00:00Z");
    const a = await makeBillingPayment({ orgId: org.id, planId: plan.id, amount: 1, createdAt: at });
    const b = await makeBillingPayment({ orgId: org.id, planId: plan.id, amount: 2, createdAt: at });
    const { items } = await listPayments({}, { orgId: org.id }, { skip: 0, take: 10 });
    expect(items.map((p) => p.id)).toEqual([a.id, b.id].sort().reverse());
  });

  it("filtres statut, type, période et référence", async () => {
    const { org, plan } = await setup();
    const event = await makeEvent(org.id);
    const request = await makePrintOrder({ eventId: event.id, orgId: org.id });
    const approved = await makeBillingPayment({ orgId: org.id, planId: plan.id, amount: 10, createdAt: new Date("2026-09-10T00:00:00Z") });
    await prisma.payment.update({ where: { id: approved.id }, data: { fedapayReference: "trx_ABC" } });
    await makeBillingPayment({ orgId: org.id, planId: plan.id, amount: 20, status: "DECLINED", createdAt: new Date("2026-09-20T00:00:00Z") });
    const print = await makePrintPayment({ orgId: org.id, printRequestId: request.id, amount: 30, createdAt: new Date("2026-10-05T00:00:00Z") });
    const scope = { orgId: org.id };
    const page = { skip: 0, take: 50 };

    expect((await listPayments({ status: "DECLINED" }, scope, page)).total).toBe(1);
    expect((await listPayments({ purpose: "PRINT_REQUEST" }, scope, page)).items.map((p) => p.id)).toEqual([print.id]);
    expect((await listPayments({ from: new Date("2026-09-15T00:00:00Z"), to: new Date("2026-09-30T23:59:59Z") }, scope, page)).total).toBe(1);
    expect((await listPayments({ q: "ABC" }, scope, page)).items.map((p) => p.id)).toEqual([approved.id]);
    const item = (await listPayments({ purpose: "PRINT_REQUEST" }, scope, page)).items[0];
    expect(item.label).toBe(`Impression ${request.reference}`);
    expect(item.printRequest).toEqual({ id: request.id, reference: request.reference, eventId: event.id });
    expect(item.planId).toBeNull();
  });

  it("le scope ne renvoie pas les paiements d'une autre organisation", async () => {
    const { org, other, plan } = await setup();
    await makeBillingPayment({ orgId: org.id, planId: plan.id, amount: 1 });
    await makeBillingPayment({ orgId: other.id, planId: plan.id, amount: 2 });
    const mine = await listPayments({ orgId: other.id }, { orgId: org.id }, { skip: 0, take: 10 });
    expect(mine.total).toBe(1);
    expect(mine.items[0].orgId).toBe(org.id);
    const all = await listPayments({ orgId: other.id }, {}, { skip: 0, take: 10 });
    expect(all.total).toBe(1);
    expect(all.items[0].orgId).toBe(other.id);
  });

  it("orgQuery filtre sur org.name et org.slug", async () => {
    const plan = await makeBillingPlan();
    const byName = await makeOrg({ name: "Zanzibar Events" });
    const bySlug = await makeOrg({ name: "Autre", slug: `zanzi-slug-${Date.now()}` });
    const none = await makeOrg({ name: "Rien" });
    for (const o of [byName, bySlug, none]) await makeBillingPayment({ orgId: o.id, planId: plan.id, amount: 1 });
    const { items } = await listPayments({ orgQuery: "zanzi" }, {}, { skip: 0, take: 20 });
    expect(items.map((p) => p.orgId).sort()).toEqual([byName.id, bySlug.id].sort());
  });

  it("loadPayment : détail complet, null hors scope et pour un id inconnu", async () => {
    const { org, other, plan, user } = await setup();
    const from = new Date("2026-10-01T00:00:00Z");
    const to = new Date("2026-10-31T00:00:00Z");
    const p = await makeBillingPayment({
      orgId: org.id, planId: plan.id, amount: 12500, userId: user.id, listPrice: 15000, prorataCredit: 2500,
      coversFrom: from, coversTo: to, mode: "IMMEDIATE",
    });
    const detail = await loadPayment(p.id, { orgId: org.id });
    expect(detail).toMatchObject({
      id: p.id, amount: 12500, listPrice: 15000, prorataCredit: 2500, coversFrom: from, coversTo: to,
      mode: "IMMEDIATE", payerName: user.name, payerEmail: user.email,
      plan: { id: plan.id, name: plan.name, period: "MONTHLY" },
      fedapayTransactionId: p.fedapayTransactionId,
    });
    expect(await loadPayment(p.id, { orgId: other.id })).toBeNull();
    expect(await loadPayment("inconnu", {})).toBeNull();
    expect((await loadPayment(p.id, {}))?.id).toBe(p.id);
  });

  it("loadPayment : paiement sans payeur ni plan", async () => {
    const { org } = await setup();
    const event = await makeEvent(org.id);
    const request = await makePrintOrder({ eventId: event.id, orgId: org.id });
    const p = await makePrintPayment({ orgId: org.id, printRequestId: request.id, amount: 100 });
    const detail = await loadPayment(p.id, { orgId: org.id });
    expect(detail).toMatchObject({ payerName: null, payerEmail: null, plan: null });
  });

  it("label tiret pour un paiement sans plan ni commande", async () => {
    const { org } = await setup();
    const p = await prisma.payment.create({ data: { orgId: org.id, amount: 5, purpose: "SUBSCRIPTION" } });
    const detail = await loadPayment(p.id, { orgId: org.id });
    expect(detail?.label).toBe("—");
  });
});
