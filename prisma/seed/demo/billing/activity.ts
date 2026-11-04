import type { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { insertInBatches, type DemoContext } from "../context";
import type { PlanCatalog } from "./plans";
import type { SeededPayment } from "./payments";
import type { SeededSubscription } from "./subscriptions";
import type { DemoWorld, WorldUser } from "./world";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

type Entry = Prisma.ActivityLogCreateManyInput;

/** Journal du domaine abonnements / paiements, date des memes instants que les lignes qu'il decrit. */
export async function writeBillingActivity(
  ctx: DemoContext,
  world: DemoWorld,
  plans: PlanCatalog,
  subs: SeededSubscription[],
  payments: SeededPayment[],
): Promise<void> {
  const now = ctx.dates.now;
  const capped = (ms: number) => new Date(Math.min(ms, now.getTime()));
  const staff: WorldUser | null =
    world.staff.find((u) => u.staffRole === "STAFF_ADMIN") ?? world.staff.find((u) => u.staffRole === "SUPER_ADMIN") ?? world.staff[0] ?? null;
  const entries: Entry[] = [];
  const add = (type: ActivityType, at: Date, e: Omit<Entry, "type" | "createdAt">) =>
    entries.push({ type, createdAt: at, ...e });
  const byStaff = (orgId: string | null) => ({ userId: staff?.id ?? null, staffActor: orgId !== null && staff !== null });

  for (const plan of Object.values(plans).filter((p) => p.name.startsWith("demo-"))) {
    add("PLAN_CREATED", capped(plan.createdAt.getTime() + HOUR_MS), {
      ...byStaff(null), targetId: plan.id,
      details: { name: plan.name, period: plan.period, maxEvents: plan.maxEvents, maxParticipantsPerEvent: plan.maxParticipantsPerEvent, price: plan.price },
    });
  }

  const legacy = plans.legacy;
  add("PLAN_UPDATED", capped(legacy.createdAt.getTime() + 60 * DAY_MS), {
    ...byStaff(null), targetId: legacy.id, details: { changes: { archived: { from: false, to: true } } },
  });

  for (const sub of subs) {
    const { scenario, org } = sub;
    const owner = org.owners[0] ?? org.members[0] ?? null;
    const actor = scenario.byStaff
      ? byStaff(org.id)
      : { userId: owner?.id ?? null, staffActor: false };

    add("SUBSCRIPTION_CREATED", capped(sub.createdAt.getTime() + MINUTE_MS), {
      ...actor, orgId: org.id, targetId: sub.subscriptionId,
      details: { planId: sub.plan.id, status: "ACTIVE" },
    });

    if (scenario.overrides) {
      add("SUBSCRIPTION_UPDATED", capped(sub.startDate.getTime() + HOUR_MS), {
        ...byStaff(org.id), orgId: org.id, targetId: sub.subscriptionId,
        details: { changes: { overrideMaxEvents: { from: null, to: "ajusté" }, overrideMaxParticipantsPerEvent: { from: null, to: "ajusté" } } },
      });
    }
    if (scenario.status === "CANCELLED") {
      add("SUBSCRIPTION_UPDATED", capped(now.getTime() - 5 * DAY_MS), {
        ...byStaff(org.id), orgId: org.id, targetId: sub.subscriptionId,
        details: { changes: { status: { from: "ACTIVE", to: "CANCELLED" } } },
      });
    }
    if (scenario.status === "EXPIRED" && sub.endDate) {
      add("SUBSCRIPTION_UPDATED", capped(sub.endDate.getTime() + HOUR_MS), {
        userId: null, staffActor: false, orgId: org.id, targetId: sub.subscriptionId,
        details: { auto: true, reason: "EXPIRED" },
      });
    }

    // Depassement delibere (essai a 1 evenement) : les evenements au-dela de la limite ont ete crees par le staff.
    const limit = sub.plan.maxEvents;
    if (scenario.key === "trial" && limit !== null) {
      const open = org.events.filter((e) => !e.archived).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      for (const event of open.slice(limit)) {
        add("QUOTA_BYPASS", capped(Math.max(event.createdAt.getTime(), sub.startDate.getTime()) + 5 * MINUTE_MS), {
          ...byStaff(org.id), orgId: org.id, eventId: event.id, targetId: event.id,
          details: { action: "EVENT_CREATE", code: "EVENT_LIMIT" },
        });
      }
    }
  }

  for (const p of payments) {
    const sub = subs.find((s) => s.subscriptionId === p.subscriptionId)!;
    const base = { userId: p.userId, staffActor: false, orgId: p.orgId, targetId: p.id };
    add("PAYMENT_INITIATED", p.createdAt, { ...base, details: { paymentId: p.id, planId: p.planId, listPrice: p.listPrice, prorataCredit: p.prorataCredit, amount: p.amount } });
    if (p.status === "APPROVED" && p.approvedAt) {
      add("PAYMENT_APPROVED", p.approvedAt, { ...base, details: { paymentId: p.id, planId: p.planId, listPrice: p.listPrice, prorataCredit: p.prorataCredit, amount: p.amount, mode: p.mode } });
      add("SUBSCRIPTION_UPDATED", new Date(p.approvedAt.getTime() + 1000), {
        userId: null, staffActor: false, orgId: p.orgId, targetId: sub.subscriptionId,
        details: { source: "payment", paymentId: p.id, planId: p.planId, mode: p.mode },
      });
    } else if (p.status !== "PENDING") {
      add("PAYMENT_FAILED", capped(p.createdAt.getTime() + 15 * MINUTE_MS), {
        ...base, details: { paymentId: p.id, amount: p.amount, status: p.status },
      });
    }
  }

  await insertInBatches(entries, (data) => prisma.activityLog.createMany({ data }), 1000);
}
