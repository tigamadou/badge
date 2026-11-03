import type { Plan } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { PERIOD_DAYS, computeSubscriptionDates } from "../../../../src/lib/subscription";
import { REMINDER_DAYS } from "../../../../src/lib/jobs/constants";
import type { DemoContext } from "../context";
import type { PlanCatalog } from "./plans";
import { assignScenarios, type Scenario } from "./scenarios";
import type { DemoWorld, WorldOrg } from "./world";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type SeededSubscription = {
  subscriptionId: string;
  orgId: string;
  org: WorldOrg;
  scenario: Scenario;
  plan: Plan;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
};

type Overrides = { maxEvents: number | null; maxParticipants: number | null };

/** Overrides du scénario, ou ajustement pour qu'un abonnement ACTIF ne dépasse jamais son quota. */
function overridesFor(scenario: Scenario, plan: Plan, org: WorldOrg): Overrides {
  const open = org.events.filter((e) => !e.archived);
  const biggest = Math.max(0, ...open.map((e) => e.countable));
  if (scenario.overrides === "near-limit") {
    return {
      maxEvents: Math.max(1, open.length),
      maxParticipants: Math.max(Math.ceil(biggest / 0.9), biggest + 1),
    };
  }
  if (scenario.overrides === "partner") {
    return { maxEvents: Math.max(20, open.length), maxParticipants: Math.max(5000, biggest) };
  }
  if (scenario.status !== "ACTIVE" || scenario.key === "trial") return { maxEvents: null, maxParticipants: null };
  return {
    maxEvents: plan.maxEvents !== null && open.length > plan.maxEvents ? open.length : null,
    maxParticipants: plan.maxParticipantsPerEvent !== null && biggest > plan.maxParticipantsPerEvent ? biggest : null,
  };
}

export async function seedSubscriptions(
  ctx: DemoContext,
  world: DemoWorld,
  plans: PlanCatalog,
): Promise<SeededSubscription[]> {
  const now = ctx.dates.now;
  const seeded: SeededSubscription[] = [];

  for (const { org, scenario } of assignScenarios(world)) {
    const plan = plans[scenario.plan];
    const startDate = new Date(now.getTime() - scenario.startDaysAgo * DAY_MS);

    let endDate: Date | null = null;
    if (scenario.endInDays !== null) {
      endDate = computeSubscriptionDates(plan.period, startDate).endDate;
      for (const p of scenario.payments) {
        if (p.mode === "EXTENSION") endDate.setUTCDate(endDate.getUTCDate() + PERIOD_DAYS[plan.period]);
      }
      const expected = now.getTime() + scenario.endInDays * DAY_MS;
      if (Math.abs(endDate.getTime() - expected) > HOUR_MS) {
        throw new Error(`Scenario ${scenario.key} : echeance ${endDate.toISOString()} incoherente avec endInDays`);
      }
    }

    const ov = overridesFor(scenario, plan, org);
    const data = {
      planId: plan.id,
      status: scenario.status,
      startDate,
      endDate,
      overrideMaxEvents: ov.maxEvents,
      overrideMaxParticipantsPerEvent: ov.maxParticipants,
      scheduledPlanId: scenario.scheduledPlan ? plans[scenario.scheduledPlan].id : null,
    };
    const row = await prisma.subscription.upsert({
      where: { orgId: org.id },
      create: { orgId: org.id, ...data },
      update: data,
    });

    // Creation = premier evenement lie a l'abonnement (premier paiement ou debut), jamais avant l'organisation.
    const firstTouch = Math.min(startDate.getTime(), ...scenario.payments.map((p) => now.getTime() - p.daysAgo * DAY_MS));
    const createdAt = new Date(Math.max(firstTouch - HOUR_MS, org.createdAt.getTime() + HOUR_MS));
    const lastTouch = Math.max(createdAt.getTime(), startDate.getTime(), ...scenario.payments.map((p) => now.getTime() - p.daysAgo * DAY_MS));
    await ctx.backdate("subscription", row.id, createdAt, new Date(Math.min(lastTouch, now.getTime())));

    await prisma.subscriptionReminder.deleteMany({ where: { subscriptionId: row.id } });
    if (endDate) {
      const reminders = scenario.reminders.filter((d) => (REMINDER_DAYS as readonly number[]).includes(d));
      await prisma.subscriptionReminder.createMany({
        data: reminders.map((daysBefore) => ({
          subscriptionId: row.id,
          endDate: endDate!,
          daysBefore,
          sentAt: new Date(Math.min(endDate!.getTime() - daysBefore * DAY_MS, now.getTime())),
        })),
      });
    }

    seeded.push({ subscriptionId: row.id, orgId: org.id, org, scenario, plan, startDate, endDate, createdAt });
  }
  return seeded;
}
