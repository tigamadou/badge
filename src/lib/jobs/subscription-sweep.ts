import { prisma } from "@/lib/prisma";
import { confirmPayment } from "@/lib/payments";
import { FedapayError } from "@/lib/fedapay";
import { settleSubscription } from "@/lib/subscription-changes";
import { notifySubscriptionExpiring } from "@/lib/notifications/triggers";
import { REMINDER_DAYS } from "./constants";

const DAY_MS = 24 * 3_600_000;
const ORPHAN_AFTER_MS = 15 * 60_000;
const EXPIRE_AFTER_MS = 24 * 3_600_000;

export type SubscriptionSweepSummary = {
  settled: number;
  reminded: number;
  reconciled: number;
  expired: number;
};

function logError(step: string, err: unknown): void {
  console.error(`[subscription-sweep] ${step}`, err);
}

// Échéances : un abonnement ACTIVE échu est réglé (bascule vers le plan programmé ou free).
async function settleDue(now: Date): Promise<number> {
  const due = await prisma.subscription.findMany({
    where: { status: "ACTIVE", endDate: { lte: now } },
    select: { orgId: true },
  });
  let settled = 0;
  for (const { orgId } of due) {
    try {
      if (await settleSubscription(orgId, now)) settled++;
    } catch (err) {
      logError(`settle ${orgId}`, err);
    }
  }
  return settled;
}

// Rappels : un seul palier par abonnement et par passage (le plus proche de l'échéance).
async function sendReminders(now: Date): Promise<number> {
  const widest = Math.max(...REMINDER_DAYS);
  const upcoming = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      scheduledPlanId: null,
      endDate: { gt: now, lte: new Date(now.getTime() + widest * DAY_MS) },
    },
    select: { id: true, orgId: true, endDate: true },
  });
  let reminded = 0;
  for (const sub of upcoming) {
    const endDate = sub.endDate as Date;
    const daysBefore = Math.min(
      ...REMINDER_DAYS.filter((d) => endDate.getTime() <= now.getTime() + d * DAY_MS),
    );
    try {
      try {
        await prisma.subscriptionReminder.create({
          data: { subscriptionId: sub.id, endDate, daysBefore },
        });
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") continue;
        throw err;
      }
      await notifySubscriptionExpiring(sub.orgId, daysBefore, endDate);
      reminded++;
    } catch (err) {
      logError(`reminder ${sub.orgId}`, err);
    }
  }
  return reminded;
}

// Paiements orphelins : relecture FedaPay après 15 min, expiration après 24 h.
async function reconcileOrphans(now: Date): Promise<{ reconciled: number; expired: number }> {
  const orphans = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      fedapayTransactionId: { not: null },
      createdAt: { lte: new Date(now.getTime() - ORPHAN_AFTER_MS) },
    },
    select: { fedapayTransactionId: true },
  });
  let reconciled = 0;
  // Un paiement dont la relecture a échoué (hors 404) reste PENDING : FedaPay l'a peut-être approuvé.
  const unverified: number[] = [];
  for (const { fedapayTransactionId } of orphans) {
    try {
      const result = await confirmPayment(fedapayTransactionId as number);
      if (result && result.status !== "PENDING") reconciled++;
    } catch (err) {
      // Transaction disparue (ex. changement d'environnement) : rien à vérifier, la règle des 24 h s'applique.
      if (!(err instanceof FedapayError && err.httpStatus === 404)) {
        unverified.push(fedapayTransactionId as number);
      }
      logError(`confirm ${fedapayTransactionId}`, err);
    }
  }
  let expired = 0;
  try {
    const res = await prisma.payment.updateMany({
      where: {
        status: "PENDING",
        createdAt: { lte: new Date(now.getTime() - EXPIRE_AFTER_MS) },
        OR: [{ fedapayTransactionId: null }, { fedapayTransactionId: { notIn: unverified } }],
      },
      data: { status: "EXPIRED" },
    });
    expired = res.count;
  } catch (err) {
    logError("expire payments", err);
  }
  return { reconciled, expired };
}

async function guarded<T>(step: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logError(step, err);
    return fallback;
  }
}

export async function runSubscriptionSweep(now: Date): Promise<SubscriptionSweepSummary> {
  const settled = await guarded("settle", 0, () => settleDue(now));
  const reminded = await guarded("remind", 0, () => sendReminders(now));
  const { reconciled, expired } = await guarded("orphans", { reconciled: 0, expired: 0 }, () =>
    reconcileOrphans(now),
  );
  return { settled, reminded, reconciled, expired };
}
