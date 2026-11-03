import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DemoContext } from "../../context";
import { seedBilling } from "../../billing";
import { seedNotificationsAndActivity } from "../../notifications";
import { buildWorld, teardownWorld } from "../../billing/__tests__/helpers";
import { ACTIVITY_NOT_SEEDED, PRINT_ACTIVITY_TYPES } from "../activity";

const DAY_MS = 86_400_000;

describe("seedActivity", () => {
  let ctx: DemoContext;

  async function run() {
    await seedBilling(ctx);
    await seedNotificationsAndActivity(ctx);
  }

  beforeEach(async () => {
    ({ ctx } = await buildWorld());
    await run();
  });
  afterEach(() => teardownWorld(ctx));

  it("couvre tous les types hors impression, sauf la liste justifiee", async () => {
    const present = new Set((await prisma.activityLog.findMany({ select: { type: true } })).map((l) => l.type));
    const wanted = Object.values(ActivityType).filter((t) => !PRINT_ACTIVITY_TYPES.includes(t) && !ACTIVITY_NOT_SEEDED.includes(t));
    expect(wanted.filter((t) => !present.has(t))).toEqual([]);
    for (const t of PRINT_ACTIVITY_TYPES) expect(present.has(t)).toBe(false);
    for (const t of ACTIVITY_NOT_SEEDED) expect(present.has(t)).toBe(false);
  });

  it("etale les dates dans la fenetre et ne devance jamais l'entite visee", async () => {
    const now = ctx.dates.now.getTime();
    const ceiling = Date.now();
    const logs = await prisma.activityLog.findMany();
    const days = new Set<number>();
    for (const l of logs) {
      expect(l.createdAt.getTime()).toBeLessThanOrEqual(ceiling);
      expect(l.createdAt.getTime()).toBeGreaterThanOrEqual(now - 180 * DAY_MS - 1000);
      days.add(Math.floor(l.createdAt.getTime() / DAY_MS));
    }
    expect(days.size).toBeGreaterThanOrEqual(20);

    const created = new Map<string, Date>();
    for (const r of await prisma.registration.findMany({ select: { id: true, createdAt: true } })) created.set(r.id, r.createdAt);
    for (const o of await prisma.organization.findMany({ select: { id: true, createdAt: true } })) created.set(o.id, o.createdAt);
    for (const e of await prisma.event.findMany({ select: { id: true, createdAt: true } })) created.set(e.id, e.createdAt);
    for (const u of await prisma.user.findMany({ select: { id: true, createdAt: true } })) created.set(u.id, u.createdAt);
    const early = logs.filter((l) => l.targetId && created.has(l.targetId) && l.createdAt < created.get(l.targetId)!);
    expect(early.map((l) => `${l.type}:${l.targetId}`)).toEqual([]);
  });

  it("journalise chaque decision, creation et impression d'inscription exactement une fois", async () => {
    const logs = await prisma.activityLog.findMany();
    const regs = await prisma.registration.findMany({ include: { event: true } });
    const count = (type: ActivityType, targetId: string) => logs.filter((l) => l.type === type && l.targetId === targetId).length;
    for (const r of regs) {
      expect(count("REGISTRATION_CREATED", r.id)).toBe(1);
      const created = logs.find((l) => l.type === "REGISTRATION_CREATED" && l.targetId === r.id)!;
      expect(created.eventId).toBe(r.eventId);
      expect(created.orgId).toBe(r.event.orgId);
      expect(count("REGISTRATION_APPROVED", r.id)).toBe(r.status === "APPROVED" ? 1 : 0);
      expect(count("REGISTRATION_REJECTED", r.id)).toBe(r.status === "REJECTED" ? 1 : 0);
      expect(count("BADGE_PRINTED", r.id)).toBe(r.badgePrinted ? 1 : 0);
      const decision = logs.find((l) => (l.type === "REGISTRATION_APPROVED" || l.type === "REGISTRATION_REJECTED") && l.targetId === r.id);
      const printed = logs.find((l) => l.type === "BADGE_PRINTED" && l.targetId === r.id);
      if (decision) expect(decision.createdAt >= created.createdAt).toBe(true);
      if (decision && printed) expect(printed.createdAt >= decision.createdAt).toBe(true);
    }
  });

  it("respecte staffActor, les connexions, les membres, les blocages, l'archivage et les jobs annules", async () => {
    const logs = await prisma.activityLog.findMany();
    const staffIds = new Set((await prisma.user.findMany({ where: { isStaff: true } })).map((u) => u.id));
    for (const l of logs) {
      expect(l.staffActor).toBe(l.orgId !== null && l.userId !== null && staffIds.has(l.userId));
      expect(JSON.stringify(l.details ?? {})).not.toMatch(/password|token|hash|secret/i);
    }
    for (const l of logs.filter((x) => x.type === "USER_LOGIN")) {
      expect(l.ipAddress).toBeTruthy();
      expect(l.userAgent).toBeTruthy();
    }
    const archivedOrg = await prisma.organization.findFirstOrThrow({ where: { archived: true } });
    expect(logs.some((l) => l.type === "ORG_ARCHIVED" && l.orgId === archivedOrg.id)).toBe(true);

    for (const m of await prisma.orgMembership.findMany()) {
      expect(logs.some((l) => l.type === "MEMBERSHIP_ADDED" && l.targetId === m.userId && l.orgId === m.orgId && l.eventId === null)).toBe(true);
    }
    for (const m of await prisma.eventMembership.findMany()) {
      expect(logs.some((l) => l.type === "MEMBERSHIP_ADDED" && l.targetId === m.userId && l.eventId === m.eventId)).toBe(true);
    }
    for (const u of await prisma.user.findMany({ where: { blocked: true } })) {
      expect(logs.some((l) => l.type === "USER_BLOCKED" && l.targetId === u.id)).toBe(true);
    }
    for (const j of await prisma.job.findMany({ where: { status: "CANCELLED" } })) {
      expect(logs.some((l) => l.type === "JOB_CANCELLED" && l.targetId === j.id)).toBe(true);
    }
  });

  it("est idempotent : deux executions du lot, memes comptes", async () => {
    const counts = async () => [await prisma.activityLog.count(), await prisma.notification.count(), await prisma.job.count(), await prisma.payment.count()];
    const before = await counts();
    await run();
    expect(await counts()).toEqual(before);
  });
});
