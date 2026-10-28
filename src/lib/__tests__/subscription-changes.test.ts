import { describe, it, expect, vi } from "vitest";
import * as activityLog from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { resolveOrgLimits } from "@/lib/subscription";
import {
  planChangeFor,
  isRunning,
  expiryTransition,
  settleSubscription,
  type PlanLite,
  type SubscriptionState,
} from "@/lib/subscription-changes";

const now = new Date("2026-11-01T00:00:00.000Z");
const std: PlanLite = { id: "p-std", name: "Standard", period: "MONTHLY", price: 15000 };
const pro: PlanLite = { id: "p-pro", name: "Pro", period: "MONTHLY", price: 30000 };
const free: PlanLite = { id: "p-free", name: "free", period: "MONTHLY", price: null };

function state(plan: PlanLite, over: Partial<SubscriptionState> = {}): SubscriptionState {
  return {
    planId: plan.id,
    plan,
    status: "ACTIVE",
    startDate: new Date("2026-10-11T00:00:00.000Z"),
    endDate: new Date("2026-11-10T00:00:00.000Z"),
    scheduledPlanId: null,
    ...over,
  };
}

describe("isRunning", () => {
  it("ACTIVE sans echeance ou echeance future", () => {
    expect(isRunning({ status: "ACTIVE", endDate: null }, now)).toBe(true);
    expect(isRunning({ status: "ACTIVE", endDate: new Date("2026-11-02T00:00:00Z") }, now)).toBe(true);
  });
  it("echu ou non ACTIVE => false", () => {
    expect(isRunning({ status: "ACTIVE", endDate: now }, now)).toBe(false);
    expect(isRunning({ status: "CANCELLED", endDate: null }, now)).toBe(false);
  });
});

describe("planChangeFor", () => {
  it("aucun abonnement → IMMEDIATE avec dates du plan", () => {
    const c = planChangeFor(null, std, now);
    expect(c).toEqual({
      mode: "IMMEDIATE",
      data: {
        planId: "p-std",
        status: "ACTIVE",
        startDate: now,
        endDate: new Date("2026-12-01T00:00:00.000Z"),
        scheduledPlanId: null,
      },
    });
  });

  it("depuis free → IMMEDIATE", () => {
    const c = planChangeFor(state(free, { endDate: null }), std, now);
    expect(c.mode).toBe("IMMEDIATE");
  });

  it("même plan → EXTENSION depuis l'ancienne échéance", () => {
    expect(planChangeFor(state(std), std, now)).toEqual({
      mode: "EXTENSION",
      data: { status: "ACTIVE", endDate: new Date("2026-12-10T00:00:00.000Z") },
    });
  });

  it("plan plus cher → IMMEDIATE depuis now, programmation effacée", () => {
    const c = planChangeFor(state(std, { scheduledPlanId: "x" }), pro, now);
    expect(c).toMatchObject({
      mode: "IMMEDIATE",
      data: { planId: "p-pro", startDate: now, scheduledPlanId: null },
    });
  });

  it("plan moins cher → SCHEDULED", () => {
    expect(planChangeFor(state(pro), std, now)).toEqual({
      mode: "SCHEDULED",
      data: { scheduledPlanId: "p-std" },
    });
  });

  it("cible sans prix (free) depuis un plan payant → SCHEDULED", () => {
    expect(planChangeFor(state(std), free, now).mode).toBe("SCHEDULED");
  });

  it("plan courant sans prix mais avec échéance, cible payante → IMMEDIATE", () => {
    const unpriced: PlanLite = { ...std, id: "p-unpriced", price: null };
    expect(planChangeFor(state(unpriced), std, now).mode).toBe("IMMEDIATE");
  });

  it("abonnement échu → IMMEDIATE même pour le même plan", () => {
    const c = planChangeFor(state(std, { endDate: new Date("2026-10-31T00:00:00Z") }), std, now);
    expect(c.mode).toBe("IMMEDIATE");
  });

  it("prix égal, autre plan → IMMEDIATE", () => {
    const other: PlanLite = { ...pro, id: "p-other", price: 15000 };
    expect(planChangeFor(state(std), other, now).mode).toBe("IMMEDIATE");
  });
});

describe("expiryTransition", () => {
  const past = new Date("2026-10-31T00:00:00.000Z");

  it("non échu → null", () => {
    expect(expiryTransition(state(std), null, free, now)).toBeNull();
  });

  it("sans échéance → null", () => {
    expect(expiryTransition(state(free, { endDate: null }), null, free, now)).toBeNull();
  });

  it("CANCELLED échu → null", () => {
    expect(expiryTransition(state(std, { status: "CANCELLED", endDate: past }), null, free, now)).toBeNull();
  });

  it("échu + programmé → SCHEDULED depuis l'ancienne endDate", () => {
    const r = expiryTransition(state(pro, { endDate: past }), std, free, now);
    expect(r).toEqual({
      reason: "SCHEDULED",
      data: {
        planId: "p-std",
        startDate: past,
        endDate: new Date("2026-11-30T00:00:00.000Z"),
        scheduledPlanId: null,
      },
    });
  });

  it("échu sans programmé → EXPIRED vers free", () => {
    expect(expiryTransition(state(std, { endDate: past }), null, free, now)).toEqual({
      reason: "EXPIRED",
      data: { planId: "p-free", startDate: now, endDate: null, scheduledPlanId: null },
    });
  });

  it("échu sans free → null", () => {
    expect(expiryTransition(state(std, { endDate: past }), null, null, now)).toBeNull();
  });
});

describe("settleSubscription", () => {
  async function setup(
    slug: string,
    opts: { withFree?: boolean; scheduled?: boolean; daysAgo?: number } = {},
  ) {
    const withFree = opts.withFree ?? true;
    const org = await prisma.organization.create({ data: { name: slug, slug } });
    const owner = await prisma.user.create({ data: { email: `${slug}@x.test`, password: "x", name: "O" } });
    await prisma.orgMembership.create({ data: { orgId: org.id, userId: owner.id, role: "OWNER" } });
    const freePlan = withFree
      ? await prisma.plan.upsert({
          where: { name: "free" },
          update: {},
          create: { name: "free", maxEvents: 1, maxParticipantsPerEvent: 10 },
        })
      : null;
    const paid = await prisma.plan.create({
      data: { name: `Standard-${slug}`, price: 15000, maxEvents: 50, maxParticipantsPerEvent: 500 },
    });
    const sched = opts.scheduled
      ? await prisma.plan.create({ data: { name: `Basic-${slug}`, price: 5000, maxEvents: 3 } })
      : null;
    const sub = await prisma.subscription.create({
      data: {
        orgId: org.id,
        planId: paid.id,
        status: "ACTIVE",
        startDate: new Date(Date.now() - 40 * 86400000),
        endDate: new Date(Date.now() - (opts.daysAgo ? opts.daysAgo * 86400000 : 1000)),
        scheduledPlanId: sched?.id ?? null,
      },
    });
    return { org, owner, freePlan, paid, sched, sub };
  }

  it("org échue → free, 1 log auto, 1 notification pour l'OWNER", async () => {
    const { org, owner, freePlan, sub } = await setup("st1");
    expect(await settleSubscription(org.id)).toBe(true);
    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(after.planId).toBe(freePlan!.id);
    expect(after.endDate).toBeNull();
    const logs = await prisma.activityLog.findMany({ where: { orgId: org.id, type: "SUBSCRIPTION_UPDATED" } });
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs[0].details)).toContain('"auto":true');
    const notifs = await prisma.notification.findMany({
      where: { type: "SUBSCRIPTION_CHANGED", userId: owner.id },
    });
    expect(notifs).toHaveLength(1);
  });

  it("plan programmé → bascule dessus", async () => {
    const { org, sched, sub } = await setup("st2", { scheduled: true });
    expect(await settleSubscription(org.id)).toBe(true);
    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(after.planId).toBe(sched!.id);
    expect(after.scheduledPlanId).toBeNull();
    expect(after.endDate!.getTime()).toBeGreaterThan(Date.now() - 12 * 86400000);
  });

  it("deux appels concurrents → un seul log", async () => {
    const { org } = await setup("st3");
    await Promise.all([settleSubscription(org.id), settleSubscription(org.id)]);
    const logs = await prisma.activityLog.findMany({ where: { orgId: org.id, type: "SUBSCRIPTION_UPDATED" } });
    expect(logs).toHaveLength(1);
  });

  it("sans abonnement ou sans transition → false", async () => {
    const org = await prisma.organization.create({ data: { name: "st4", slug: "st4" } });
    expect(await settleSubscription(org.id)).toBe(false);
  });

  it("échu sans plan free → inchangé (bloqué)", async () => {
    const { org } = await setup("st5", { withFree: false });
    expect(await settleSubscription(org.id)).toBe(false);
  });

  it("programmé mais aussi échu → enchaîne vers free, deux transitions loggées", async () => {
    const { org, freePlan, sub } = await setup("st7", { scheduled: true, daysAgo: 40 });
    expect(await settleSubscription(org.id)).toBe(true);
    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(after.planId).toBe(freePlan!.id);
    const logs = await prisma.activityLog.findMany({ where: { orgId: org.id, type: "SUBSCRIPTION_UPDATED" } });
    expect(logs).toHaveLength(2);
  });

  it("resolveOrgLimits : programmé + échu depuis longtemps → active sur free", async () => {
    const { org, freePlan } = await setup("st8", { scheduled: true, daysAgo: 40 });
    expect(await resolveOrgLimits(org.id)).toMatchObject({
      maxEvents: freePlan!.maxEvents,
      active: true,
    });
  });

  it("un log en échec ne fait pas échouer settleSubscription (transition appliquée)", async () => {
    const { org, freePlan, sub } = await setup("st9");
    const spy = vi.spyOn(activityLog, "logActivity").mockRejectedValueOnce(new Error("boom"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(resolveOrgLimits(org.id)).resolves.toMatchObject({ active: true });
      expect(err).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      err.mockRestore();
    }
    const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(after.planId).toBe(freePlan!.id);
  });

  it("resolveOrgLimits d'une org échue → active et limites de free", async () => {
    const { org, freePlan } = await setup("st6");
    expect(await resolveOrgLimits(org.id)).toEqual({
      maxEvents: freePlan!.maxEvents,
      maxParticipantsPerEvent: freePlan!.maxParticipantsPerEvent,
      active: true,
    });
  });
});
