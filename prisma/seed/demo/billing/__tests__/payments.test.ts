import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import type { DemoContext } from "../../context";
import { seedBilling } from "../../billing";
import { FEDAPAY_ID_BASE } from "../payments";
import { assignScenarios } from "../scenarios";
import { loadWorld, type DemoWorld } from "../world";
import { buildWorld, teardownWorld } from "./helpers";

describe("seedSubscriptionPayments", () => {
  let ctx: DemoContext;
  let world: DemoWorld;

  beforeEach(async () => {
    ({ ctx, world } = await buildWorld());
    await seedBilling(ctx);
  });
  afterEach(() => teardownWorld(ctx));

  it("couvre les 5 statuts et les 3 modes, avec des champs coherents", async () => {
    const payments = await prisma.payment.findMany({ include: { plan: true } });
    expect(new Set(payments.map((p) => p.status))).toEqual(new Set(["PENDING", "APPROVED", "DECLINED", "CANCELED", "EXPIRED"]));
    expect(new Set(payments.filter((p) => p.status === "APPROVED").map((p) => p.mode))).toEqual(
      new Set(["IMMEDIATE", "EXTENSION", "SCHEDULED"]),
    );

    const ids = new Set<number>();
    for (const p of payments) {
      expect(p.purpose).toBe("SUBSCRIPTION");
      expect(p.planId).not.toBeNull();
      expect(p.printRequestId).toBeNull();
      expect(p.amount).toBe(p.plan!.price);
      expect(p.currency).toBe("XOF");
      expect(p.approvedAt !== null).toBe(p.status === "APPROVED");
      expect(p.mode !== null).toBe(p.status === "APPROVED");
      expect(p.createdAt <= ctx.dates.now).toBe(true);
      if (p.status === "PENDING") {
        expect(p.fedapayTransactionId).toBeNull();
      } else {
        expect(p.fedapayTransactionId).toBeGreaterThanOrEqual(FEDAPAY_ID_BASE);
        expect(p.fedapayTransactionId).toBeLessThanOrEqual(919_999_999);
        expect(ids.has(p.fedapayTransactionId!)).toBe(false);
        ids.add(p.fedapayTransactionId!);
      }
    }
  });

  it("garde le payeur parmi les owners quand l'organisation en a, et relie paiements et abonnements", async () => {
    const payments = await prisma.payment.findMany({ orderBy: { createdAt: "asc" } });
    const subs = await prisma.subscription.findMany({ include: { plan: true } });
    const assignments = new Map(assignScenarios(await loadWorld()).map((a) => [a.org.id, a.scenario]));

    for (const p of payments) {
      const org = world.orgs.find((o) => o.id === p.orgId)!;
      if (org.owners.length > 0) expect(org.owners.map((o) => o.id)).toContain(p.userId);
    }
    for (const sub of subs) {
      const own = payments.filter((p) => p.orgId === sub.orgId);
      const approved = own.filter((p) => p.status === "APPROVED");
      if (sub.plan.price !== null) expect(approved.length).toBeGreaterThan(0);
      expect(own).toHaveLength(assignments.get(sub.orgId)!.payments.length);

      const immediate = approved.filter((p) => p.mode === "IMMEDIATE");
      if (immediate.length > 0) expect(immediate[immediate.length - 1].approvedAt!.getTime()).toBe(sub.startDate.getTime());
      const scheduled = approved.find((p) => p.mode === "SCHEDULED");
      if (scheduled) expect(scheduled.planId).toBe(sub.scheduledPlanId);
      const extension = approved.find((p) => p.mode === "EXTENSION");
      if (extension) {
        const firstEnd = new Date(sub.startDate.getTime() + 30 * 86_400_000);
        expect(extension.approvedAt!.getTime()).toBeLessThan(firstEnd.getTime());
      }
    }
  });

  it("ecrit le journal de la facturation avec les bons acteurs et des dates ordonnees", async () => {
    const logs = await prisma.activityLog.findMany();
    const types = new Set(logs.map((l) => l.type));
    for (const t of ["PLAN_CREATED", "PAYMENT_INITIATED", "PAYMENT_APPROVED", "PAYMENT_FAILED", "SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED", "QUOTA_BYPASS"]) {
      expect(types.has(t as never)).toBe(true);
    }
    const staffIds = new Set((await prisma.user.findMany({ where: { isStaff: true } })).map((u) => u.id));
    for (const l of logs) {
      expect(l.createdAt <= ctx.dates.now).toBe(true);
      expect(l.staffActor).toBe(l.orgId !== null && l.userId !== null && staffIds.has(l.userId));
    }
    const payments = await prisma.payment.findMany();
    for (const p of payments) {
      expect(logs.filter((l) => l.type === "PAYMENT_INITIATED" && l.targetId === p.id)).toHaveLength(1);
      const done = logs.filter((l) => (l.type === "PAYMENT_APPROVED" || l.type === "PAYMENT_FAILED") && l.targetId === p.id);
      expect(done).toHaveLength(p.status === "PENDING" ? 0 : 1);
      if (done[0]) expect(done[0].createdAt >= p.createdAt).toBe(true);
    }
    const subs = await prisma.subscription.findMany();
    for (const s of subs) {
      const created = logs.find((l) => l.type === "SUBSCRIPTION_CREATED" && l.targetId === s.id)!;
      expect(created.createdAt >= s.createdAt).toBe(true);
    }
  });

  it("est idempotent : deux executions, memes comptes de paiements et de journal", async () => {
    const counts = async () => [await prisma.payment.count(), await prisma.activityLog.count()];
    const before = await counts();
    await seedBilling(ctx);
    expect(await counts()).toEqual(before);
  });
});
