import { getDb } from "./db";

// Fixtures e2e du lot abonnements / paiements. Les plans portent le prefixe `e2e-bill-` : le nettoyage global
// ne les connait pas, `cleanupBillingPlans` les retire (a appeler APRES `cleanupE2ETestData`, qui supprime
// d'abord les organisations et donc leurs abonnements et paiements en cascade).
export const BILLING_PLAN_PREFIX = "e2e-bill-";
export const DAY_MS = 86_400_000;

export type TestBillingPlan = { id: string; name: string; price: number | null };

export async function createTestPlan(opts: {
  scope: string;
  price: number | null;
  period?: "MONTHLY" | "ANNUAL";
  publicVisible?: boolean;
  highlighted?: boolean;
  position?: number;
  description?: string;
  features?: string[];
  archived?: boolean;
}): Promise<TestBillingPlan> {
  const name = `${BILLING_PLAN_PREFIX}${opts.scope}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const plan = await getDb().plan.create({
    data: {
      name,
      period: opts.period ?? "MONTHLY",
      price: opts.price,
      publicVisible: opts.publicVisible ?? false,
      highlighted: opts.highlighted ?? false,
      position: opts.position ?? 0,
      description: opts.description ?? null,
      features: opts.features ?? undefined,
      archived: opts.archived ?? false,
    },
  });
  return { id: plan.id, name, price: plan.price };
}

// Remplace l'abonnement de l'organisation (cree par createTestOrgWithOwner) par celui decrit.
export async function setSubscription(
  orgId: string,
  opts: {
    planId: string;
    status?: "ACTIVE" | "EXPIRED" | "CANCELLED";
    startDate: Date;
    endDate: Date | null;
  },
): Promise<void> {
  await getDb().subscription.update({
    where: { orgId },
    data: {
      planId: opts.planId,
      status: opts.status ?? "ACTIVE",
      startDate: opts.startDate,
      endDate: opts.endDate,
      scheduledPlanId: null,
    },
  });
}

export async function createTestSubscriptionPayment(opts: {
  orgId: string;
  planId: string;
  amount: number;
  status?: "PENDING" | "APPROVED" | "DECLINED" | "CANCELED" | "EXPIRED";
  userId?: string;
  listPrice?: number;
  prorataCredit?: number;
  coversFrom?: Date;
  coversTo?: Date;
  mode?: "IMMEDIATE" | "EXTENSION" | "SCHEDULED";
  createdAt?: Date;
}): Promise<{ id: string; fedapayTransactionId: number | null; fedapayReference: string | null }> {
  const status = opts.status ?? "APPROVED";
  const fedapayTransactionId = status === "PENDING" ? null : 900_000_000 + Math.floor(Math.random() * 99_000_000);
  const payment = await getDb().payment.create({
    data: {
      orgId: opts.orgId,
      purpose: "SUBSCRIPTION",
      planId: opts.planId,
      userId: opts.userId ?? null,
      amount: opts.amount,
      listPrice: opts.listPrice ?? opts.amount,
      prorataCredit: opts.prorataCredit ?? 0,
      coversFrom: opts.coversFrom ?? null,
      coversTo: opts.coversTo ?? null,
      mode: status === "APPROVED" ? (opts.mode ?? "IMMEDIATE") : null,
      currency: "XOF",
      status,
      fedapayTransactionId,
      fedapayReference: fedapayTransactionId ? `trx_e2e_${fedapayTransactionId}` : null,
      approvedAt: status === "APPROVED" ? (opts.createdAt ?? new Date()) : null,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
    select: { id: true, fedapayTransactionId: true, fedapayReference: true },
  });
  return payment;
}

export async function cleanupBillingPlans(): Promise<void> {
  await getDb()
    .plan.deleteMany({ where: { name: { startsWith: BILLING_PLAN_PREFIX } } })
    .catch(() => undefined);
}

// "12 345 FCFA" (espaces insecables fines) -> 12345
export function digits(text: string): number {
  return Number(text.replace(/\D/g, ""));
}

// Meme format que l'UI : jj/mm/aaaa en UTC.
export function fmtDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}
