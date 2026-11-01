import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { notifySubscriptionChanged } from "@/lib/notifications/triggers";
import { PERIOD_DAYS, computeSubscriptionDates } from "@/lib/subscription";
import type { SubscriptionPeriod, SubscriptionStatus } from "@prisma/client";

export type PlanLite = {
  id: string;
  name: string;
  period: SubscriptionPeriod;
  price: number | null;
};

export type SubscriptionState = {
  planId: string;
  plan: PlanLite;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date | null;
  scheduledPlanId: string | null;
};

export type PlanChange =
  | {
      mode: "IMMEDIATE";
      data: {
        planId: string;
        status: "ACTIVE";
        startDate: Date;
        endDate: Date | null;
        scheduledPlanId: null;
      };
    }
  | { mode: "EXTENSION"; data: { status: "ACTIVE"; endDate: Date } }
  | { mode: "SCHEDULED"; data: { scheduledPlanId: string } };

// Abonnement en cours : ACTIVE et sans echeance ou echeance future.
export function isRunning(
  sub: Pick<SubscriptionState, "status" | "endDate">,
  now: Date,
): boolean {
  return sub.status === "ACTIVE" && (sub.endDate == null || sub.endDate > now);
}

// Regle de changement de plan (spec paiement FedaPay, decisions 2 et 3).
export function planChangeFor(
  current: SubscriptionState | null,
  target: PlanLite,
  now: Date,
): PlanChange {
  const immediate = (): PlanChange => ({
    mode: "IMMEDIATE",
    data: {
      planId: target.id,
      status: "ACTIVE",
      ...computeSubscriptionDates(target.period, now),
      scheduledPlanId: null,
    },
  });

  if (!current || !isRunning(current, now) || current.endDate === null) {
    return immediate();
  }
  if (target.id === current.planId) {
    const endDate = new Date(current.endDate);
    endDate.setUTCDate(endDate.getUTCDate() + PERIOD_DAYS[target.period]);
    return { mode: "EXTENSION", data: { status: "ACTIVE", endDate } };
  }
  if ((target.price ?? 0) < (current.plan.price ?? 0)) {
    return { mode: "SCHEDULED", data: { scheduledPlanId: target.id } };
  }
  return immediate();
}

// Transition a appliquer quand l'echeance est depassee : bascule vers le plan
// programme, sinon passage a EXPIRED (le plan reste inchange, pas de repli sur free).
export function expiryTransition(
  sub: SubscriptionState,
  scheduled: PlanLite | null,
  now: Date,
):
  | {
      reason: "SCHEDULED";
      data: {
        planId: string;
        startDate: Date;
        endDate: Date;
        scheduledPlanId: null;
      };
    }
  | {
      reason: "EXPIRED";
      data: { status: "EXPIRED"; scheduledPlanId: null };
    }
  | null {
  if (sub.status !== "ACTIVE" || sub.endDate === null || sub.endDate > now) {
    return null;
  }
  if (scheduled) {
    return {
      reason: "SCHEDULED",
      data: {
        planId: scheduled.id,
        ...computeSubscriptionDates(scheduled.period, sub.endDate),
        scheduledPlanId: null,
      },
    };
  }
  return { reason: "EXPIRED", data: { status: "EXPIRED", scheduledPlanId: null } };
}

const PLAN_LITE_SELECT = { id: true, name: true, period: true, price: true } as const;

// Applique la transition d'echeance d'une org (idempotent : la garde sur
// endDate/status empeche une double application concurrente). Chemin chaud :
// une lecture legere suffit tant que l'abonnement n'est pas echu.
export async function settleSubscription(
  orgId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const head = await prisma.subscription.findUnique({
    where: { orgId },
    select: { status: true, endDate: true },
  });
  if (!head || head.status !== "ACTIVE" || head.endDate === null || head.endDate > now) {
    return false;
  }

  const sub = await prisma.subscription.findUniqueOrThrow({
    where: { orgId },
    include: {
      plan: { select: PLAN_LITE_SELECT },
      scheduledPlan: { select: PLAN_LITE_SELECT },
    },
  });
  let state: SubscriptionState = sub;
  let scheduled: PlanLite | null = sub.scheduledPlan;
  let applied = false;

  // Un plan programme peut etre lui-meme echu (abonnement perime de longue date) :
  // on enchaine, au plus 3 transitions ; la boucle s'arrete apres EXPIRED.
  for (let i = 0; i < 3; i += 1) {
    const transition = expiryTransition(state, scheduled, now);
    if (!transition) break;

    const { count } = await prisma.subscription.updateMany({
      where: { id: sub.id, endDate: state.endDate, status: "ACTIVE" },
      data: transition.data,
    });
    if (count !== 1) break;
    applied = true;

    try {
      await logActivity({
        type: "SUBSCRIPTION_UPDATED",
        orgId,
        targetId: sub.id,
        details: {
          auto: true,
          reason: transition.reason,
          planId: transition.reason === "SCHEDULED" ? transition.data.planId : state.planId,
        },
      });
      await notifySubscriptionChanged(orgId, null);
    } catch (error) {
      console.error("[subscription] journal/notification de transition en echec", error);
    }

    if (transition.reason === "EXPIRED") break;
    state = { ...state, ...transition.data, plan: scheduled!, status: "ACTIVE" };
    scheduled = null;
  }
  return applied;
}
