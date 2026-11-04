import type { PaymentStatus, SubscriptionChangeMode } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { DEMO_SLUG_PREFIX } from "../../constants";
import {
  computeProrataCredit,
  coversFor,
  isRunning,
  planChangeFor,
  type CoveredPayment,
  type PlanLite,
  type SubscriptionState,
} from "../../../../src/lib/subscription-changes";
import type { DemoContext } from "../context";
import type { PlanCatalog } from "./plans";
import type { SeededSubscription } from "./subscriptions";
import type { DemoWorld } from "./world";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
export const FEDAPAY_ID_BASE = 910_000_000;
const APPROVAL_LAG_MS = 4 * MINUTE_MS;

export type SeededPayment = {
  id: string;
  orgId: string;
  planId: string;
  userId: string | null;
  subscriptionId: string;
  scenarioKey: string;
  amount: number;
  listPrice: number;
  prorataCredit: number;
  status: PaymentStatus;
  mode: SubscriptionChangeMode | null;
  approvedAt: Date | null;
  createdAt: Date;
};

type Planned = {
  sub: SeededSubscription;
  plan: PlanLite & { id: string };
  status: PaymentStatus;
  specMode: SubscriptionChangeMode | undefined;
  at: Date; // approbation (APPROVED) ou creation
};

const lite = (p: { id: string; name: string; period: PlanLite["period"]; price: number | null }): PlanLite => ({
  id: p.id, name: p.name, period: p.period, price: p.price,
});

type Resolved = {
  mode: SubscriptionChangeMode;
  coversFrom: Date;
  coversTo: Date;
  listPrice: number;
  credit: number;
  amount: number;
};

/**
 * Rejoue les paiements APPROVED d'un abonnement dans l'ordre : déduit leur mode avec `planChangeFor`, la période
 * achetée avec `coversFor` et, pour une montée en gamme sur un abonnement en cours, le crédit au prorata du
 * montant réellement payé (mêmes fonctions pures que le checkout et la confirmation).
 */
function resolveModes(planned: Planned[], sub: SeededSubscription): Map<Planned, Resolved> {
  const resolved = new Map<Planned, Resolved>();
  let state = null as SubscriptionState | null;
  const earlier: (CoveredPayment & { planId: string })[] = [];
  const approved = planned.filter((p) => p.status === "APPROVED").sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const p of approved) {
    const target = lite(p.plan);
    const change = planChangeFor(state, target, p.at);
    if (p.specMode && p.specMode !== change.mode) {
      throw new Error(`Scenario ${sub.scenario.key} : mode ${p.specMode} attendu, ${change.mode} calcule (corriger les dates)`);
    }
    const listPrice = target.price ?? 0;
    const credit =
      change.mode === "IMMEDIATE" && state && isRunning(state, p.at)
        ? Math.min(computeProrataCredit(earlier.filter((e) => e.planId === state!.planId), p.at), listPrice)
        : 0;
    const covers = coversFor(change, state, target);
    resolved.set(p, { mode: change.mode, ...covers, listPrice, credit, amount: listPrice - credit });
    earlier.push({ planId: target.id, amount: listPrice - credit, coversFrom: covers.coversFrom, coversTo: covers.coversTo });

    if (change.mode === "IMMEDIATE") {
      state = { plan: target, ...change.data };
    } else if (change.mode === "EXTENSION" && state) {
      state = { ...state, ...change.data };
    } else if (change.mode === "SCHEDULED" && state) {
      state = { ...state, ...change.data };
    }
  }
  if (state && sub.endDate && state.endDate?.getTime() !== sub.endDate.getTime()) {
    throw new Error(`Scenario ${sub.scenario.key} : echeance des paiements incoherente avec l'abonnement`);
  }
  return resolved;
}

export async function seedSubscriptionPayments(
  ctx: DemoContext,
  _world: DemoWorld,
  plans: PlanCatalog,
  subs: SeededSubscription[],
): Promise<SeededPayment[]> {
  const now = ctx.dates.now;
  await prisma.payment.deleteMany({
    where: { purpose: "SUBSCRIPTION", org: { slug: { startsWith: DEMO_SLUG_PREFIX } } },
  });

  const seeded: SeededPayment[] = [];
  let sequence = 0;
  for (const sub of subs) {
    const planned: Planned[] = sub.scenario.payments.map((spec) => ({
      sub,
      plan: plans[spec.plan ?? sub.scenario.plan],
      status: spec.status,
      specMode: spec.mode,
      at: new Date(now.getTime() - spec.daysAgo * DAY_MS),
    }));
    const modes = resolveModes(planned, sub);
    const payerPool = sub.org.owners.length > 0 ? sub.org.owners : sub.org.members;

    for (const p of planned) {
      if (p.plan.price === null) throw new Error(`Plan ${p.plan.name} sans prix : paiement impossible`);
      const approved = p.status === "APPROVED";
      const createdAt = approved ? new Date(p.at.getTime() - APPROVAL_LAG_MS) : p.at;
      const approvedAt = approved ? p.at : null;
      const payer = payerPool.length > 0 ? ctx.faker.helpers.arrayElement(payerPool) : null;
      // Un PENDING n'a pas de transaction : le sweep relirait sinon chez FedaPay apres 15 min.
      const withTransaction = p.status !== "PENDING";
      const r = modes.get(p) ?? null;
      const mode = r?.mode ?? null;
      // Un paiement non approuvé garde le prix plein, sans crédit ni période achetée.
      const listPrice = r?.listPrice ?? p.plan.price;
      const prorataCredit = r?.credit ?? 0;
      const amount = r?.amount ?? p.plan.price;

      const row = await prisma.payment.create({
        data: {
          orgId: sub.orgId,
          purpose: "SUBSCRIPTION",
          planId: p.plan.id,
          userId: payer?.id ?? null,
          amount,
          listPrice,
          prorataCredit,
          coversFrom: r?.coversFrom ?? null,
          coversTo: r?.coversTo ?? null,
          currency: "XOF",
          status: p.status,
          fedapayTransactionId: withTransaction ? FEDAPAY_ID_BASE + sequence : null,
          mode,
          approvedAt,
        },
      });
      if (withTransaction) {
        await prisma.payment.update({ where: { id: row.id }, data: { fedapayReference: `demo-${row.id}` } });
      }
      await ctx.backdate("payment", row.id, createdAt, approvedAt ?? createdAt);
      sequence++;

      seeded.push({
        id: row.id, orgId: sub.orgId, planId: p.plan.id, userId: payer?.id ?? null,
        subscriptionId: sub.subscriptionId, scenarioKey: sub.scenario.key, amount, listPrice, prorataCredit,
        status: p.status, mode, approvedAt, createdAt,
      });
    }
  }
  return seeded;
}
