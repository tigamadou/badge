import type { NextRequest } from "next/server";
import type { PaymentStatus, SubscriptionChangeMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import {
  FedapayError,
  getFedapayConfig,
  createPaymentUrl,
  createTransaction,
  isPaidStatus,
  retrieveTransaction,
} from "@/lib/fedapay";
import { planChangeFor } from "@/lib/subscription-changes";
import { notifySubscriptionChanged } from "@/lib/notifications/triggers";

export type PaymentErrorCode =
  | "PLAN_NOT_FOR_SALE"
  | "CHANGE_ALREADY_SCHEDULED"
  | "PAYMENTS_DISABLED"
  | "PROVIDER_ERROR";

const HTTP_STATUS: Record<PaymentErrorCode, number> = {
  PLAN_NOT_FOR_SALE: 400,
  CHANGE_ALREADY_SCHEDULED: 409,
  PAYMENTS_DISABLED: 503,
  PROVIDER_ERROR: 502,
};

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly httpStatus: number;

  constructor(code: PaymentErrorCode) {
    super(code);
    this.name = "PaymentError";
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
  }
}

const PLAN_LITE_SELECT = { id: true, name: true, period: true, price: true } as const;

export async function startCheckout(input: {
  orgId: string;
  planId: string;
  userId: string;
  req?: NextRequest;
}): Promise<{ paymentId: string; url: string }> {
  const { orgId, planId, userId, req } = input;

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || plan.archived || plan.price === null || plan.price <= 0) {
    throw new PaymentError("PLAN_NOT_FOR_SALE");
  }

  const subscription = await prisma.subscription.findUnique({
    where: { orgId },
    select: { scheduledPlanId: true },
  });
  if (subscription?.scheduledPlanId) {
    throw new PaymentError("CHANGE_ALREADY_SCHEDULED");
  }

  const { configured } = getFedapayConfig();
  if (!configured) throw new PaymentError("PAYMENTS_DISABLED");

  const [org, user] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } }),
  ]);

  const payment = await prisma.payment.create({
    data: { orgId, planId, userId, amount: plan.price, currency: "XOF", status: "PENDING" },
  });

  let url: string;
  try {
    const baseUrl = (process.env.NEXTAUTH_URL as string).replace(/\/$/, "");
    const tx = await createTransaction({
      description: `Abonnement ${plan.name} — ${org.name}`,
      amount: plan.price,
      callbackUrl: `${baseUrl}/org/${orgId}/subscription/return`,
      customer: { email: user.email, firstname: user.name },
      metadata: { paymentId: payment.id, orgId },
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { fedapayTransactionId: tx.id, fedapayReference: tx.reference },
    });
    url = await createPaymentUrl(tx.id);
  } catch (error) {
    console.error("[checkout fedapay]", error instanceof FedapayError ? error.code : (error as Error).name);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "CANCELED" } });
    throw new PaymentError("PROVIDER_ERROR");
  }

  await logActivity({
    type: "PAYMENT_INITIATED",
    userId,
    orgId,
    targetId: payment.id,
    details: { paymentId: payment.id, planId, amount: plan.price },
    req,
  });

  return { paymentId: payment.id, url };
}

// EXPIRED : balaye apres 24 h mais encore confirmable si FedaPay l'approuve ensuite.
const CONFIRMABLE: PaymentStatus[] = ["PENDING", "EXPIRED"];

// Passe un paiement PENDING (ou EXPIRED) a un statut final (idempotent : un seul appelant gagne).
async function failPayment(
  paymentId: string,
  orgId: string,
  userId: string | null,
  status: "DECLINED" | "CANCELED",
  reason: string,
): Promise<{ status: PaymentStatus; applied: boolean }> {
  const { count } = await prisma.payment.updateMany({
    where: { id: paymentId, status: { in: CONFIRMABLE } },
    data: { status },
  });
  if (count === 1) {
    await logActivity({
      type: "PAYMENT_FAILED",
      userId: userId ?? undefined,
      orgId,
      targetId: paymentId,
      details: { paymentId, reason },
    });
  }
  return { status, applied: false };
}

// Seule la transaction relue aupres de FedaPay fait foi (statut, montant, devise).
// Les erreurs FedaPay remontent a l'appelant et laissent le paiement PENDING.
export async function confirmPayment(
  fedapayTransactionId: number,
): Promise<{ status: PaymentStatus; applied: boolean } | null> {
  const payment = await prisma.payment.findUnique({
    where: { fedapayTransactionId },
    include: { plan: { select: PLAN_LITE_SELECT } },
  });
  if (!payment) return null;
  if (!CONFIRMABLE.includes(payment.status)) return { status: payment.status, applied: false };

  const tx = await retrieveTransaction(fedapayTransactionId);

  if (tx.status === "pending") return { status: payment.status, applied: false };

  if (!isPaidStatus(tx.status)) {
    const status = tx.status === "canceled" ? "CANCELED" : "DECLINED";
    return failPayment(payment.id, payment.orgId, payment.userId, status, tx.status);
  }

  const mismatch =
    tx.amount !== payment.amount || (tx.currencyIso !== "" && tx.currencyIso !== "XOF");
  if (mismatch) {
    console.error("[confirm fedapay] montant/devise incohérents", {
      paymentId: payment.id,
      expected: { amount: payment.amount, currency: "XOF" },
      received: { amount: tx.amount, currency: tx.currencyIso },
    });
    return failPayment(payment.id, payment.orgId, payment.userId, "DECLINED", "MISMATCH");
  }

  const now = new Date();
  const mode = await prisma.$transaction(async (db): Promise<SubscriptionChangeMode | null> => {
    const { count } = await db.payment.updateMany({
      where: { id: payment.id, status: { in: CONFIRMABLE } },
      data: { status: "APPROVED", approvedAt: now },
    });
    if (count !== 1) return null;

    // Verrou de ligne : deux paiements distincts de la meme org s'appliquent l'un apres l'autre.
    await db.$queryRaw`SELECT id FROM Subscription WHERE orgId = ${payment.orgId} FOR UPDATE`;
    const current = await db.subscription.findUnique({
      where: { orgId: payment.orgId },
      include: { plan: { select: PLAN_LITE_SELECT } },
    });
    const change = planChangeFor(current, { ...payment.plan, price: payment.amount }, now);

    if (change.mode === "IMMEDIATE") {
      await db.subscription.upsert({
        where: { orgId: payment.orgId },
        update: change.data,
        create: { orgId: payment.orgId, ...change.data },
      });
    } else {
      await db.subscription.update({ where: { orgId: payment.orgId }, data: change.data });
    }
    await db.payment.update({ where: { id: payment.id }, data: { mode: change.mode } });
    return change.mode;
  });

  if (mode === null) return { status: "APPROVED", applied: false };

  try {
    await logActivity({
      type: "PAYMENT_APPROVED",
      userId: payment.userId ?? undefined,
      orgId: payment.orgId,
      targetId: payment.id,
      details: { paymentId: payment.id, mode },
    });
    await logActivity({
      type: "SUBSCRIPTION_UPDATED",
      userId: payment.userId ?? undefined,
      orgId: payment.orgId,
      details: { source: "payment", paymentId: payment.id },
    });
    await notifySubscriptionChanged(payment.orgId, null);
  } catch (error) {
    console.error("[payment] journal/notification apres paiement en echec", error);
  }

  return { status: "APPROVED", applied: true };
}
