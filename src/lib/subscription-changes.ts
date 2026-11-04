import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { notifySubscriptionChanged } from "@/lib/notifications/triggers";
import { PERIOD_DAYS, computeSubscriptionDates } from "@/lib/subscription";
import type { Prisma, SubscriptionChangeMode, SubscriptionPeriod, SubscriptionStatus } from "@prisma/client";

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

// ---------------------------------------------------------------------------
// Devis de changement de plan (prorata, fenetre de renouvellement, periodes couvertes)
// ---------------------------------------------------------------------------

export const RENEWAL_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CoveredPayment = { amount: number; coversFrom: Date | null; coversTo: Date | null };

// Credit restant : somme, par paiement, de amount x restant / duree (plancher par paiement).
// Calcul en BigInt : un gros montant x une annee en ms depasse 2^53.
export function computeProrataCredit(payments: CoveredPayment[], now: Date): number {
  let total = BigInt(0);
  for (const p of payments) {
    if (!p.coversFrom || !p.coversTo || p.coversTo <= now) continue;
    const duration = p.coversTo.getTime() - p.coversFrom.getTime();
    if (duration <= 0) continue;
    const remaining = p.coversTo.getTime() - Math.max(now.getTime(), p.coversFrom.getTime());
    total += (BigInt(p.amount) * BigInt(remaining)) / BigInt(duration);
  }
  return Number(total);
}

// Credit des paiements d'abonnement approuves du plan courant dont la periode n'est pas echue.
export async function loadProrataCredit(
  db: Pick<Prisma.TransactionClient, "payment">,
  orgId: string,
  planId: string,
  now: Date,
): Promise<number> {
  const payments = await db.payment.findMany({
    where: {
      orgId,
      planId,
      purpose: "SUBSCRIPTION",
      status: "APPROVED",
      coversTo: { gt: now },
    },
    select: { amount: true, coversFrom: true, coversTo: true },
  });
  return computeProrataCredit(payments, now);
}

export type CheckoutQuote =
  | {
      allowed: true;
      mode: SubscriptionChangeMode;
      listPrice: number;
      credit: number;
      amount: number;
      daysLeft: number | null;
    }
  | { allowed: false; reason: "ALREADY_ACTIVE"; activeUntil: Date | null; renewableFrom: Date | null };

// Devis a la creation d'un paiement : applique le blocage du meme plan (hors fenetre des
// 7 derniers jours) et le prorata d'une montee en gamme. La confirmation, elle, n'applique
// jamais ce blocage : l'argent recu est toujours applique (planChangeFor).
export function quoteChange(
  current: SubscriptionState | null,
  target: PlanLite,
  now: Date,
  credit: number,
): CheckoutQuote {
  const listPrice = target.price ?? 0;
  const running = current !== null && isRunning(current, now);

  if (current && running && current.planId === target.id && current.endDate === null) {
    return { allowed: false, reason: "ALREADY_ACTIVE", activeUntil: null, renewableFrom: null };
  }

  const change = planChangeFor(current, target, now);

  if (change.mode === "EXTENSION" && current?.endDate) {
    const renewableFrom = new Date(current.endDate.getTime() - RENEWAL_WINDOW_DAYS * DAY_MS);
    if (now < renewableFrom) {
      return { allowed: false, reason: "ALREADY_ACTIVE", activeUntil: current.endDate, renewableFrom };
    }
  }

  if (change.mode === "IMMEDIATE" && running) {
    const applied = Math.min(credit, listPrice);
    const daysLeft = current.endDate
      ? Math.max(0, Math.ceil((current.endDate.getTime() - now.getTime()) / DAY_MS))
      : null;
    return { allowed: true, mode: "IMMEDIATE", listPrice, credit: applied, amount: listPrice - applied, daysLeft };
  }

  return { allowed: true, mode: change.mode, listPrice, credit: 0, amount: listPrice, daysLeft: null };
}

// Periode achetee par un paiement, selon le changement applique.
export function coversFor(
  change: PlanChange,
  current: SubscriptionState | null,
  target: PlanLite,
): { coversFrom: Date; coversTo: Date } {
  if (change.mode === "IMMEDIATE") {
    return { coversFrom: change.data.startDate, coversTo: change.data.endDate as Date };
  }
  if (change.mode === "EXTENSION") {
    return { coversFrom: current!.endDate as Date, coversTo: change.data.endDate };
  }
  const coversFrom = current!.endDate as Date;
  const coversTo = new Date(coversFrom);
  coversTo.setUTCDate(coversTo.getUTCDate() + PERIOD_DAYS[target.period]);
  return { coversFrom, coversTo };
}
