import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { PERIOD_DAYS } from "@/lib/subscription";
import { REMINDER_DAYS } from "@/lib/jobs/constants";
import type { DemoContext } from "../../context";
import { seedBilling } from "../../billing";
import { assignScenarios } from "../scenarios";
import { loadWorld, type DemoWorld } from "../world";
import { buildWorld, teardownWorld } from "./helpers";

const DAY_MS = 86_400_000;

describe("seedSubscriptions", () => {
  let ctx: DemoContext;
  let world: DemoWorld;

  beforeEach(async () => {
    ({ ctx, world } = await buildWorld());
    await seedBilling(ctx);
  });
  afterEach(() => teardownWorld(ctx));

  it("couvre chaque statut et periodicite, et donne un abonnement a chaque organisation", async () => {
    const subs = await prisma.subscription.findMany({ include: { plan: true } });
    expect(new Set(subs.map((s) => s.status))).toEqual(new Set(["ACTIVE", "EXPIRED", "CANCELLED"]));
    expect(new Set(subs.map((s) => s.plan.period))).toEqual(new Set(["MONTHLY", "ANNUAL"]));
    expect(subs.some((s) => s.scheduledPlanId)).toBe(true);
    expect(subs.some((s) => s.overrideMaxEvents !== null || s.overrideMaxParticipantsPerEvent !== null)).toBe(true);
    expect(subs.some((s) => s.endDate === null)).toBe(true);

    expect(subs).toHaveLength(world.orgs.length);
    expect(await prisma.organization.count({ where: { subscription: { is: null } } })).toBe(0);
  });

  it("garde des dates coherentes : jamais d'ACTIVE echu, duree de periode, statuts terminaux sans plan programme", async () => {
    const now = ctx.dates.now;
    const assignments = new Map(assignScenarios(await loadWorld()).map((a) => [a.org.id, a.scenario]));
    const subs = await prisma.subscription.findMany({ include: { plan: true } });
    for (const s of subs) {
      const scenario = assignments.get(s.orgId)!;
      if (s.status === "ACTIVE") expect(s.endDate === null || s.endDate > now).toBe(true);
      if (s.status !== "ACTIVE") expect(s.scheduledPlanId).toBeNull();
      expect(s.startDate <= now).toBe(true);
      if (s.endDate && !scenario.payments.some((p) => p.mode === "EXTENSION")) {
        expect(Math.round((s.endDate.getTime() - s.startDate.getTime()) / DAY_MS)).toBe(PERIOD_DAYS[s.plan.period]);
      }
      expect(s.createdAt <= now).toBe(true);
    }
  });

  it("cree les rappels attendus et aucun sur un plan programme", async () => {
    const now = ctx.dates.now;
    const assignments = new Map(assignScenarios(await loadWorld()).map((a) => [a.org.id, a.scenario]));
    const subs = await prisma.subscription.findMany({ include: { reminders: true } });
    for (const s of subs) {
      const scenario = assignments.get(s.orgId)!;
      expect(s.reminders.map((r) => r.daysBefore).sort((a, b) => b - a)).toEqual(scenario.reminders);
      if (s.scheduledPlanId) expect(s.reminders).toHaveLength(0);
      for (const r of s.reminders) {
        expect((REMINDER_DAYS as readonly number[]).includes(r.daysBefore)).toBe(true);
        expect(r.endDate.getTime()).toBe(s.endDate!.getTime());
        expect(r.sentAt.getTime()).toBe(Math.min(s.endDate!.getTime() - r.daysBefore * DAY_MS, now.getTime()));
      }
    }
    const byKey = (key: string) => subs.find((s) => assignments.get(s.orgId)!.key === key)!;
    expect(byKey("expiring-7").reminders.map((r) => r.daysBefore)).toEqual([7]);
    expect(byKey("expiring-1").reminders.map((r) => r.daysBefore).sort()).toEqual([1, 7]);
  });

  it("respecte les quotas des abonnements actifs, sauf l'essai, et approche la limite pour near-limit", async () => {
    const assignments = new Map(assignScenarios(world).map((a) => [a.org.id, a.scenario]));
    const subs = await prisma.subscription.findMany({ include: { plan: true } });
    for (const s of subs.filter((x) => x.status === "ACTIVE")) {
      const scenario = assignments.get(s.orgId)!;
      const org = world.orgs.find((o) => o.id === s.orgId)!;
      const open = org.events.filter((e) => !e.archived);
      const maxEvents = s.overrideMaxEvents ?? s.plan.maxEvents;
      const maxPart = s.overrideMaxParticipantsPerEvent ?? s.plan.maxParticipantsPerEvent;
      if (scenario.key === "trial") {
        expect(maxEvents).toBe(1);
        expect(open.length).toBeGreaterThan(1);
        continue;
      }
      if (maxEvents !== null) expect(open.length).toBeLessThanOrEqual(maxEvents);
      if (maxPart !== null) for (const e of open) expect(e.countable).toBeLessThanOrEqual(maxPart);

      if (scenario.key === "near-limit") {
        const biggest = Math.max(...open.map((e) => e.countable));
        expect(maxEvents).toBe(open.length);
        expect(maxPart).toBe(Math.max(Math.ceil(biggest / 0.9), biggest + 1));
        expect(biggest).toBeLessThan(maxPart!);
        if (biggest >= 9) expect(biggest / maxPart!).toBeGreaterThanOrEqual(0.85);
      }
    }
  });

  it("est idempotent : relancer ne duplique ni abonnement ni rappel", async () => {
    const counts = async () => [
      await prisma.subscription.count(),
      await prisma.subscriptionReminder.count(),
      await prisma.plan.count(),
    ];
    const before = await counts();
    await seedBilling(ctx);
    expect(await counts()).toEqual(before);
  });
});
