import { describe, it, expect, beforeAll } from "vitest";
import { seedFactories, makeOrg, makeEvent, makePrintOrder } from "@/test/factories";
import { makeBillingPlan, makeBillingPayment, makePrintPayment } from "@/test/factories-billing";
import { prisma } from "@/lib/prisma";
import {
  computeProrataCredit,
  coversFor,
  loadProrataCredit,
  planChangeFor,
  quoteChange,
  RENEWAL_WINDOW_DAYS,
  type PlanLite,
  type SubscriptionState,
} from "@/lib/subscription-changes";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-01T00:00:00.000Z");
const at = (days: number, ms = 0) => new Date(now.getTime() + days * DAY + ms);

describe("computeProrataCredit", () => {
  it("sans période couverte ne donne aucun crédit", () => {
    expect(computeProrataCredit([{ amount: 30000, coversFrom: null, coversTo: null }], now)).toBe(0);
  });

  it("crédite le restant au prorata, plancher", () => {
    const j0 = at(-10);
    const p = { amount: 30000, coversFrom: j0, coversTo: new Date(j0.getTime() + 30 * DAY) };
    expect(computeProrataCredit([p], now)).toBe(20000);
    expect(computeProrataCredit([p], new Date(now.getTime() + 1))).toBe(19999);
  });

  it("une période future entière est créditée en entier", () => {
    expect(computeProrataCredit([{ amount: 30000, coversFrom: at(30), coversTo: at(60) }], now)).toBe(30000);
  });

  it("ignore une période échue", () => {
    expect(computeProrataCredit([{ amount: 30000, coversFrom: at(-30), coversTo: now }], now)).toBe(0);
    expect(computeProrataCredit([{ amount: 30000, coversFrom: at(-30), coversTo: at(-1) }], now)).toBe(0);
  });

  it("ignore une période de durée nulle ou négative", () => {
    expect(computeProrataCredit([{ amount: 30000, coversFrom: at(5), coversTo: at(5) }], now)).toBe(0);
  });

  it("somme les paiements (extension comprise)", () => {
    const first = { amount: 30000, coversFrom: at(-15), coversTo: at(15) };
    const second = { amount: 30000, coversFrom: at(15), coversTo: at(45) };
    expect(computeProrataCredit([first, second], now)).toBe(15000 + 30000);
  });

  it("ne déborde pas sur de gros montants", () => {
    const from = at(-1);
    const p = { amount: 10_000_000, coversFrom: from, coversTo: new Date(from.getTime() + 365 * DAY) };
    expect(computeProrataCredit([p], now)).toBe(Math.floor((10_000_000 * 364) / 365));
    expect(computeProrataCredit([p], now)).toBe(9972602);
  });

  it("plancher par paiement", () => {
    // 1 XOF sur 2 ms avec 1 ms restante = 0,5 par paiement => 0 + 0 (et non 1)
    const half = { amount: 1, coversFrom: new Date(now.getTime() - 1), coversTo: new Date(now.getTime() + 1) };
    expect(computeProrataCredit([half, half], now)).toBe(0);
  });
});

const std: PlanLite = { id: "p-std", name: "Standard", period: "MONTHLY", price: 15000 };
const pro: PlanLite = { id: "p-pro", name: "Pro", period: "MONTHLY", price: 30000 };
const annual: PlanLite = { id: "p-annual", name: "Annuel", period: "ANNUAL", price: 450000 };

function state(plan: PlanLite, over: Partial<SubscriptionState> = {}): SubscriptionState {
  return {
    planId: plan.id,
    plan,
    status: "ACTIVE",
    startDate: at(-20),
    endDate: at(10),
    scheduledPlanId: null,
    ...over,
  };
}

describe("quoteChange", () => {
  it("même plan hors fenêtre : bloqué avec la date de renouvellement", () => {
    const endDate = at(8);
    const q = quoteChange(state(pro, { endDate }), pro, now, 0);
    expect(q).toEqual({
      allowed: false,
      reason: "ALREADY_ACTIVE",
      activeUntil: endDate,
      renewableFrom: new Date(endDate.getTime() - RENEWAL_WINDOW_DAYS * DAY),
    });
  });

  it("même plan à J-7 pile : extension ; à J-7 + 1 ms : bloqué", () => {
    const ok = quoteChange(state(pro, { endDate: at(7) }), pro, now, 500);
    expect(ok).toEqual({ allowed: true, mode: "EXTENSION", listPrice: 30000, credit: 0, amount: 30000, daysLeft: null });
    expect(quoteChange(state(pro, { endDate: at(7, 1) }), pro, now, 0).allowed).toBe(false);
  });

  it("même plan sans échéance : bloqué sans date", () => {
    const q = quoteChange(state(pro, { endDate: null }), pro, now, 0);
    expect(q).toEqual({ allowed: false, reason: "ALREADY_ACTIVE", activeUntil: null, renewableFrom: null });
  });

  it("plan moins cher : programmé sans crédit", () => {
    const q = quoteChange(state(pro), std, now, 9000);
    expect(q).toEqual({ allowed: true, mode: "SCHEDULED", listPrice: 15000, credit: 0, amount: 15000, daysLeft: null });
  });

  it("plan plus cher : immédiat, prix plein moins crédit", () => {
    const q = quoteChange(state(std, { endDate: at(10, 1) }), pro, now, 12000);
    expect(q).toEqual({ allowed: true, mode: "IMMEDIATE", listPrice: 30000, credit: 12000, amount: 18000, daysLeft: 11 });
  });

  it("plan plus cher sans échéance : daysLeft nul", () => {
    const q = quoteChange(state(std, { endDate: null }), pro, now, 0);
    expect(q).toMatchObject({ allowed: true, mode: "IMMEDIATE", daysLeft: null, amount: 30000 });
  });

  it("crédit supérieur au prix : plafonné, montant nul", () => {
    const q = quoteChange(state(std), pro, now, 50000);
    expect(q).toMatchObject({ allowed: true, mode: "IMMEDIATE", credit: 30000, amount: 0 });
  });

  it("abonnement échu, expiré ou absent : immédiat sans crédit", () => {
    const expected = { allowed: true, mode: "IMMEDIATE", listPrice: 30000, credit: 0, amount: 30000, daysLeft: null };
    expect(quoteChange(state(std, { endDate: at(-1) }), pro, now, 9000)).toEqual(expected);
    expect(quoteChange(state(std, { status: "EXPIRED" }), pro, now, 9000)).toEqual(expected);
    expect(quoteChange(null, pro, now, 9000)).toEqual(expected);
  });

  it("plan sans prix : montant nul", () => {
    const q = quoteChange(null, { ...pro, price: null }, now, 0);
    expect(q).toMatchObject({ allowed: true, listPrice: 0, amount: 0 });
  });

  it("compare le prix brut entre périodes", () => {
    expect(quoteChange(state(pro), annual, now, 0)).toMatchObject({ mode: "IMMEDIATE" });
    expect(quoteChange(state(annual), pro, now, 0)).toMatchObject({ mode: "SCHEDULED" });
  });
});

describe("coversFor", () => {
  it("IMMEDIATE : nouvelle période", () => {
    const change = planChangeFor(state(std), pro, now);
    if (change.mode !== "IMMEDIATE") throw new Error("mode");
    expect(coversFor(change, state(std), pro)).toEqual({ coversFrom: change.data.startDate, coversTo: change.data.endDate });
  });

  it("EXTENSION : de l'ancienne à la nouvelle échéance", () => {
    const current = state(pro, { endDate: at(5) });
    const change = planChangeFor(current, pro, now);
    expect(coversFor(change, current, pro)).toEqual({ coversFrom: at(5), coversTo: at(35) });
  });

  it("SCHEDULED : de l'échéance à l'échéance plus la période du plan programmé", () => {
    const current = state(pro, { endDate: at(5) });
    const change = planChangeFor(current, std, now);
    expect(coversFor(change, current, std)).toEqual({ coversFrom: at(5), coversTo: at(35) });
    const change2 = planChangeFor(current, { ...std, period: "ANNUAL" }, now);
    expect(coversFor(change2, current, { ...std, period: "ANNUAL" })).toEqual({ coversFrom: at(5), coversTo: at(370) });
  });
});

describe("loadProrataCredit", () => {
  beforeAll(() => seedFactories(2201));

  it("ne retient que les paiements d'abonnement approuvés du plan courant et de l'org", async () => {
    const org = await makeOrg();
    const other = await makeOrg();
    const plan = await makeBillingPlan();
    const otherPlan = await makeBillingPlan();
    const base = { orgId: org.id, planId: plan.id, amount: 30000, coversFrom: at(-10), coversTo: at(20) };

    await makeBillingPayment(base); // 20000
    await makeBillingPayment({ ...base, status: "PENDING" });
    await makeBillingPayment({ ...base, planId: otherPlan.id });
    await makeBillingPayment({ ...base, orgId: other.id });
    await makeBillingPayment({ ...base, coversFrom: null, coversTo: null });
    await makeBillingPayment({ ...base, coversFrom: at(-40), coversTo: at(-10) });
    const event = await makeEvent(org.id);
    const request = await makePrintOrder({ eventId: event.id, orgId: org.id });
    await makePrintPayment({ orgId: org.id, printRequestId: request.id, amount: 5000 });

    expect(await loadProrataCredit(prisma, org.id, plan.id, now)).toBe(20000);
  });
});
