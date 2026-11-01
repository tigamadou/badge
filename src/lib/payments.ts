import type { NextRequest } from "next/server";
import type { PaymentPurpose, PaymentStatus, SubscriptionChangeMode } from "@prisma/client";
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
import {
  notifyPrintPaymentUnmatched,
  notifyPrintRequestPaid,
  notifySubscriptionChanged,
} from "@/lib/notifications/triggers";
import { lockRequestWithEvent, markPaid } from "@/lib/print-requests/service";
import { appendThreadEvent } from "@/lib/print-requests/thread";

export type PaymentErrorCode =
  | "PLAN_NOT_FOR_SALE"
  | "CHANGE_ALREADY_SCHEDULED"
  | "PAYMENTS_DISABLED"
  | "PROVIDER_ERROR"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_NOT_PAYABLE"
  | "PAYMENT_IN_PROGRESS";

const HTTP_STATUS: Record<PaymentErrorCode, number> = {
  PLAN_NOT_FOR_SALE: 400,
  CHANGE_ALREADY_SCHEDULED: 409,
  PAYMENTS_DISABLED: 503,
  PROVIDER_ERROR: 502,
  REQUEST_NOT_FOUND: 404,
  REQUEST_NOT_PAYABLE: 409,
  PAYMENT_IN_PROGRESS: 409,
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

// Ouvre la transaction FedaPay d'un Payment deja cree et renvoie l'URL de paiement.
// En cas d'echec, le Payment passe CANCELED et PROVIDER_ERROR est levee.
async function openTransaction(
  paymentId: string,
  tx: {
    description: string;
    amount: number;
    callbackPath: string;
    customer: { email: string; firstname: string };
    metadata: Record<string, string>;
  },
): Promise<string> {
  try {
    const baseUrl = (process.env.NEXTAUTH_URL as string).replace(/\/$/, "");
    const created = await createTransaction({
      description: tx.description,
      amount: tx.amount,
      callbackUrl: `${baseUrl}${tx.callbackPath}`,
      customer: tx.customer,
      metadata: tx.metadata,
    });
    await prisma.payment.update({
      where: { id: paymentId },
      data: { fedapayTransactionId: created.id, fedapayReference: created.reference },
    });
    return await createPaymentUrl(created.id);
  } catch (error) {
    console.error("[checkout fedapay]", error instanceof FedapayError ? error.code : (error as Error).name);
    await prisma.payment.update({ where: { id: paymentId }, data: { status: "CANCELED" } });
    throw new PaymentError("PROVIDER_ERROR");
  }
}

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

  const url = await openTransaction(payment.id, {
    description: `Abonnement ${plan.name} — ${org.name}`,
    amount: plan.price,
    callbackPath: `/org/${orgId}/subscription/return`,
    customer: { email: user.email, firstname: user.name },
    metadata: { paymentId: payment.id, orgId },
  });

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

// Un Payment PENDING sans transaction plus jeune que ce delai : un autre checkout l'ouvre encore.
const CHECKOUT_OPENING_MS = 2 * 60 * 1000;
const PRINT_CHECKOUT_ATTEMPTS = 2;

type PayableRequest = { reference: string; acceptedTotal: number; eventTitle: string };

// Erreurs de metier communes au controle initial et a la relecture sous verrou.
function assertPayable(
  request: {
    reference: string;
    eventId: string;
    orgId: string;
    status: string;
    acceptedTotal: number | null;
    event: { title: string };
  } | null,
  scope: { orgId: string; eventId: string },
): PayableRequest {
  if (!request || request.eventId !== scope.eventId || request.orgId !== scope.orgId) {
    throw new PaymentError("REQUEST_NOT_FOUND");
  }
  if (request.status !== "ACCEPTED" || request.acceptedTotal === null || request.acceptedTotal <= 0) {
    throw new PaymentError("REQUEST_NOT_PAYABLE");
  }
  return { reference: request.reference, acceptedTotal: request.acceptedTotal, eventTitle: request.event.title };
}

const PAYABLE_SELECT = {
  reference: true,
  eventId: true,
  orgId: true,
  status: true,
  acceptedTotal: true,
  event: { select: { title: true } },
} as const;

type Candidate = { id: string; fedapayTransactionId: number };

// Garantit un seul paiement en cours par demande : cree le Payment sous le verrou de la demande
// (evenement puis demande), ou renvoie le paiement PENDING a reutiliser.
async function prepareCheckout(input: {
  orgId: string;
  eventId: string;
  requestId: string;
  userId: string;
}): Promise<{ request: PayableRequest; paymentId: string } | { request: PayableRequest; candidate: Candidate }> {
  const { orgId, eventId, requestId, userId } = input;
  return prisma.$transaction(async (db) => {
    await lockRequestWithEvent(db, requestId);
    const request = assertPayable(
      await db.printRequest.findUnique({ where: { id: requestId }, select: PAYABLE_SELECT }),
      { orgId, eventId },
    );
    const pending = await db.payment.findFirst({
      where: { printRequestId: requestId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (pending?.fedapayTransactionId && pending.amount === request.acceptedTotal) {
      return { request, candidate: { id: pending.id, fedapayTransactionId: pending.fedapayTransactionId } };
    }
    if (pending) {
      if (!pending.fedapayTransactionId && Date.now() - pending.createdAt.getTime() < CHECKOUT_OPENING_MS) {
        throw new PaymentError("PAYMENT_IN_PROGRESS");
      }
      // Checkout interrompu (rien presente au client) ou montant different du devis accepte : remplace.
      await db.payment.updateMany({ where: { id: pending.id, status: "PENDING" }, data: { status: "CANCELED" } });
      if (pending.fedapayTransactionId) {
        await appendThreadEvent(db, requestId, "PAYMENT_FAILED", {
          amount: pending.amount, paymentId: pending.id, reason: "REPLACED",
        });
      }
    }
    const created = await db.payment.create({
      data: {
        orgId, userId, purpose: "PRINT_REQUEST", printRequestId: requestId, planId: null,
        amount: request.acceptedTotal, currency: "XOF", status: "PENDING",
      },
    });
    return { request, paymentId: created.id };
  });
}

export async function startPrintRequestCheckout(input: {
  orgId: string;
  eventId: string;
  requestId: string;
  userId: string;
  req?: NextRequest;
}): Promise<{ paymentId: string; url: string }> {
  const { orgId, eventId, requestId, userId, req } = input;

  assertPayable(
    await prisma.printRequest.findUnique({ where: { id: requestId }, select: PAYABLE_SELECT }),
    { orgId, eventId },
  );
  if (!getFedapayConfig().configured) throw new PaymentError("PAYMENTS_DISABLED");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } });

  for (let attempt = 0; attempt < PRINT_CHECKOUT_ATTEMPTS; attempt += 1) {
    const prepared = await prepareCheckout(input);

    if ("paymentId" in prepared) {
      const { request, paymentId } = prepared;
      const url = await openTransaction(paymentId, {
        description: `Impression ${request.reference} — ${request.eventTitle}`,
        amount: request.acceptedTotal,
        callbackPath: `/event/${eventId}/print/${requestId}/return`,
        customer: { email: user.email, firstname: user.name },
        metadata: { paymentId, printRequestId: requestId },
      });
      await logActivity({
        type: "PAYMENT_INITIATED",
        userId,
        orgId,
        targetId: paymentId,
        details: { paymentId, purpose: "PRINT_REQUEST", printRequestId: requestId, amount: request.acceptedTotal },
        req,
      });
      return { paymentId, url };
    }

    // Paiement PENDING deja ouvert chez FedaPay : on ne retient que ce que FedaPay confirme.
    const { candidate } = prepared;
    let status: string | null;
    try {
      status = (await retrieveTransaction(candidate.fedapayTransactionId)).status;
    } catch (error) {
      if (!(error instanceof FedapayError) || error.httpStatus !== 404) throw providerError(error);
      status = null;
    }

    if (status === "pending") {
      try {
        return { paymentId: candidate.id, url: await createPaymentUrl(candidate.fedapayTransactionId) };
      } catch (error) {
        throw providerError(error);
      }
    }
    if (status === null) {
      // Transaction inconnue de FedaPay : le paiement est remplace par un nouveau.
      const stale = await prisma.payment.findUniqueOrThrow({ where: { id: candidate.id } });
      await failPayment(stale, "CANCELED", "REPLACED");
    } else {
      try {
        await confirmPayment(candidate.fedapayTransactionId);
      } catch (error) {
        throw providerError(error);
      }
    }
    // Reprise : si la demande est devenue PAID, assertPayable leve REQUEST_NOT_PAYABLE.
  }
  throw new PaymentError("PAYMENT_IN_PROGRESS");
}

function providerError(error: unknown): PaymentError {
  console.error("[checkout fedapay]", error instanceof FedapayError ? error.code : (error as Error).name);
  return new PaymentError("PROVIDER_ERROR");
}

// EXPIRED : balaye apres 24 h mais encore confirmable si FedaPay l'approuve ensuite.
const CONFIRMABLE: PaymentStatus[] = ["PENDING", "EXPIRED"];
// Demande d'impression : un paiement remplace (CANCELED) peut etre paye ensuite chez FedaPay ; l'argent
// recu doit laisser une trace (PAID, ou PAYMENT_UNMATCHED + alerte du staff), jamais etre ignore.
const CONFIRMABLE_PRINT: PaymentStatus[] = [...CONFIRMABLE, "CANCELED"];

type PaymentRef = {
  id: string;
  orgId: string;
  userId: string | null;
  amount: number;
  purpose: PaymentPurpose;
  printRequestId: string | null;
};

// Passe un paiement PENDING (ou EXPIRED) a un statut final (idempotent : un seul appelant gagne).
// Raisons du journal : declined, canceled (FedaPay), MISMATCH (montant/devise), REPLACED (checkout remplace).
async function failPayment(
  payment: PaymentRef,
  status: "DECLINED" | "CANCELED",
  reason: string,
): Promise<{ status: PaymentStatus; applied: boolean }> {
  const { id: paymentId, orgId, userId } = payment;
  if (payment.purpose === "PRINT_REQUEST" && payment.printRequestId) {
    const requestId = payment.printRequestId;
    // Verrou de la demande avant le Payment (meme ordre que le checkout) : pas d'interblocage.
    const count = await prisma.$transaction(async (db) => {
      await lockRequestWithEvent(db, requestId);
      const res = await db.payment.updateMany({
        // CANCELED n'est rattrapable que pour l'argent recu a un montant errone ; sinon rejeu = sans effet.
        where: {
          id: paymentId,
          status: { in: status === "DECLINED" && reason === "MISMATCH" ? CONFIRMABLE_PRINT : CONFIRMABLE },
        },
        data: { status },
      });
      if (res.count === 1) {
        await appendThreadEvent(db, requestId, "PAYMENT_FAILED", { amount: payment.amount, paymentId, reason });
      }
      return res.count;
    });
    if (count === 1) {
      await logActivity({
        type: "PAYMENT_FAILED",
        userId: userId ?? undefined,
        orgId,
        targetId: paymentId,
        details: { paymentId, reason, purpose: "PRINT_REQUEST", printRequestId: requestId },
      });
      // Argent recu pour un montant ou une devise inattendu : le staff doit regler.
      if (reason === "MISMATCH") {
        try {
          await notifyPrintPaymentUnmatched(requestId, paymentId);
        } catch (error) {
          console.error("[payment] notification apres paiement en echec", error);
        }
      }
    }
    return { status, applied: false };
  }
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

type PrintIssue = "PAID" | "UNMATCHED";

// Branche demande d'impression : verrou de la demande AVANT le Payment (C2), puis la demande ne
// passe PAID que si elle attend encore exactement ce montant ; sinon l'entree du fil prévient le staff.
async function applyPrintRequestPayment(
  payment: PaymentRef & { printRequestId: string },
  now: Date,
): Promise<PrintIssue | null> {
  const requestId = payment.printRequestId;
  return prisma.$transaction(async (db): Promise<PrintIssue | null> => {
    await lockRequestWithEvent(db, requestId);
    const { count } = await db.payment.updateMany({
      where: { id: payment.id, status: { in: CONFIRMABLE_PRINT } },
      data: { status: "APPROVED", approvedAt: now },
    });
    if (count !== 1) return null;

    const request = await db.printRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { status: true, acceptedTotal: true },
    });
    const expected = request.status === "ACCEPTED" && request.acceptedTotal === payment.amount;
    if (expected && (await markPaid(db, requestId, { paymentId: payment.id }))) return "PAID";

    await appendThreadEvent(db, requestId, "PAYMENT_UNMATCHED", { paymentId: payment.id, amount: payment.amount });
    return "UNMATCHED";
  });
}

// Seule la transaction relue aupres de FedaPay fait foi (statut, montant, devise).
// Les erreurs FedaPay remontent a l'appelant et laissent le paiement PENDING.
export async function confirmPayment(
  fedapayTransactionId: number,
): Promise<{ status: PaymentStatus; applied: boolean } | null> {
  const payment = await prisma.payment.findUnique({
    where: { fedapayTransactionId },
    include: { plan: { select: PLAN_LITE_SELECT }, printRequest: { select: { id: true } } },
  });
  if (!payment) return null;
  const confirmable = payment.purpose === "PRINT_REQUEST" ? CONFIRMABLE_PRINT : CONFIRMABLE;
  if (!confirmable.includes(payment.status)) return { status: payment.status, applied: false };

  // Règle : SUBSCRIPTION <=> plan seul, PRINT_REQUEST <=> demande seule. Avant tout appel FedaPay.
  const plan = payment.plan;
  if (payment.purpose === "SUBSCRIPTION" ? !plan || payment.printRequest : !payment.printRequest || plan) {
    throw new Error("Paiement incohérent");
  }
  const tx = await retrieveTransaction(fedapayTransactionId);

  // Un paiement deja CANCELED ne change que s'il est approuve : tout autre statut FedaPay est sans effet.
  if (tx.status === "pending" || (payment.status === "CANCELED" && !isPaidStatus(tx.status))) {
    return { status: payment.status, applied: false };
  }

  if (!isPaidStatus(tx.status)) {
    const status = tx.status === "canceled" ? "CANCELED" : "DECLINED";
    return failPayment(payment, status, tx.status);
  }

  const mismatch =
    tx.amount !== payment.amount || (tx.currencyIso !== "" && tx.currencyIso !== "XOF");
  if (mismatch) {
    console.error("[confirm fedapay] montant/devise incohérents", {
      paymentId: payment.id,
      expected: { amount: payment.amount, currency: "XOF" },
      received: { amount: tx.amount, currency: tx.currencyIso },
    });
    return failPayment(payment, "DECLINED", "MISMATCH");
  }

  const now = new Date();
  // La garde de cohérence garantit : pas de plan <=> PRINT_REQUEST avec sa demande.
  if (!plan) {
    return confirmPrintRequestPayment({ ...payment, printRequestId: payment.printRequestId as string }, now);
  }

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
    const change = planChangeFor(current, { ...plan, price: payment.amount }, now);

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

// Hors transaction : journal et notifications ne doivent jamais défaire le paiement.
async function confirmPrintRequestPayment(
  payment: PaymentRef & { printRequestId: string },
  now: Date,
): Promise<{ status: PaymentStatus; applied: boolean }> {
  const issue = await applyPrintRequestPayment(payment, now);
  if (issue === null) return { status: "APPROVED", applied: false };

  try {
    await logActivity({
      type: "PAYMENT_APPROVED",
      userId: payment.userId ?? undefined,
      orgId: payment.orgId,
      targetId: payment.id,
      details: {
        paymentId: payment.id,
        purpose: "PRINT_REQUEST",
        printRequestId: payment.printRequestId,
        unmatched: issue === "UNMATCHED",
      },
    });
  } catch (error) {
    console.error("[payment] journal apres paiement en echec", error);
  }
  // Notification a part : un echec du journal ne doit pas la supprimer.
  try {
    if (issue === "PAID") await notifyPrintRequestPaid(payment.printRequestId, payment.userId);
    else await notifyPrintPaymentUnmatched(payment.printRequestId, payment.id);
  } catch (error) {
    console.error("[payment] notification apres paiement en echec", error);
  }
  return { status: "APPROVED", applied: issue === "PAID" };
}
