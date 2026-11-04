// Fabriques du lot 2b (abonnements, paiements) : ecrivent dans la vraie base de test.
// Noms distincts de makePlan / makePayment de factories.ts (socle, lecture seule).
import { faker } from "@faker-js/faker";
import type { PaymentStatus, Prisma, SubscriptionChangeMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function makeBillingPlan(data: Partial<Prisma.PlanUncheckedCreateInput> = {}) {
  return prisma.plan.create({
    data: {
      name: `Plan ${faker.string.alphanumeric(10)}`,
      maxEvents: 10,
      maxParticipantsPerEvent: 1000,
      price: 15000,
      period: "MONTHLY",
      ...data,
    },
  });
}

export function makeSubscription(
  orgId: string,
  planId: string,
  data: Partial<Prisma.SubscriptionUncheckedCreateInput> = {},
) {
  return prisma.subscription.create({
    data: { orgId, planId, status: "ACTIVE", ...data },
  });
}

export function makeBillingPayment(input: {
  orgId: string;
  planId: string;
  amount: number;
  status?: PaymentStatus;
  userId?: string | null;
  coversFrom?: Date | null;
  coversTo?: Date | null;
  listPrice?: number | null;
  prorataCredit?: number | null;
  mode?: SubscriptionChangeMode | null;
  approvedAt?: Date | null;
  fedapayTransactionId?: number | null;
  createdAt?: Date;
}) {
  const status = input.status ?? "APPROVED";
  return prisma.payment.create({
    data: {
      orgId: input.orgId,
      planId: input.planId,
      purpose: "SUBSCRIPTION",
      amount: input.amount,
      status,
      userId: input.userId ?? null,
      coversFrom: input.coversFrom ?? null,
      coversTo: input.coversTo ?? null,
      listPrice: input.listPrice ?? null,
      prorataCredit: input.prorataCredit ?? null,
      mode: input.mode ?? null,
      approvedAt: input.approvedAt !== undefined ? input.approvedAt : status === "APPROVED" ? new Date() : null,
      fedapayTransactionId:
        input.fedapayTransactionId !== undefined
          ? input.fedapayTransactionId
          : status === "PENDING"
            ? null
            : faker.number.int({ min: 900_000_000, max: 2_000_000_000 }),
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
}

export function makePrintPayment(input: {
  orgId: string;
  printRequestId: string;
  amount: number;
  status?: PaymentStatus;
  userId?: string | null;
  approvedAt?: Date | null;
  fedapayTransactionId?: number | null;
  createdAt?: Date;
}) {
  const status = input.status ?? "APPROVED";
  return prisma.payment.create({
    data: {
      orgId: input.orgId,
      purpose: "PRINT_REQUEST",
      printRequestId: input.printRequestId,
      amount: input.amount,
      status,
      userId: input.userId ?? null,
      approvedAt: input.approvedAt !== undefined ? input.approvedAt : status === "APPROVED" ? new Date() : null,
      fedapayTransactionId:
        input.fedapayTransactionId !== undefined
          ? input.fedapayTransactionId
          : status === "PENDING"
            ? null
            : faker.number.int({ min: 900_000_000, max: 2_000_000_000 }),
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
  });
}
