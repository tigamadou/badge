import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { NOTIFICATIONS_PAGE_SIZE } from "@/lib/notifications/queries";
import type { NotificationType } from "@prisma/client";
import type { DemoContext } from "../../context";
import { seedBilling } from "../../billing";
import { buildWorld, teardownWorld } from "../../billing/__tests__/helpers";
import { loadWorld, type DemoWorld } from "../../billing/world";
import { seedJobs } from "../jobs";
import { cleanupNotifications, seedNotifications, PRINT_NOTIFICATION_TYPES } from "../notifications";

const DAY_MS = 86_400_000;

describe("seedNotifications", () => {
  let ctx: DemoContext;
  let world: DemoWorld;

  async function run() {
    await seedBilling(ctx);
    world = await loadWorld();
    await cleanupNotifications();
    const jobs = await seedJobs(ctx, world);
    await seedNotifications(ctx, world, jobs);
  }

  beforeEach(async () => {
    ({ ctx } = await buildWorld());
    await run();
  });
  afterEach(() => teardownWorld(ctx));

  it("couvre les 18 types hors impression et les 4 portees", async () => {
    const rows = await prisma.notification.findMany();
    const types = new Set(rows.map((r) => r.type));
    const expected = (await import("@prisma/client")).NotificationType;
    const wanted = Object.values(expected).filter((t) => !PRINT_NOTIFICATION_TYPES.includes(t as NotificationType));
    expect(wanted).toHaveLength(18);
    expect([...types].sort()).toEqual([...wanted].sort());
    expect(new Set(rows.map((r) => r.scope))).toEqual(new Set(["PLATFORM", "ORG", "EVENT", "PARTICIPANT"]));
  });

  it("melange lues et non lues, dates dans la fenetre et liens coherents", async () => {
    const now = ctx.dates.now.getTime();
    const rows = await prisma.notification.findMany();
    const mixed = new Set<string>();
    for (const t of new Set(rows.map((r) => r.type))) {
      const own = rows.filter((r) => r.type === t);
      if (own.some((r) => r.readAt) && own.some((r) => !r.readAt)) mixed.add(t);
    }
    expect(mixed.size).toBeGreaterThanOrEqual(5);

    for (const r of rows) {
      expect(r.createdAt.getTime()).toBeLessThanOrEqual(now);
      expect(r.createdAt.getTime()).toBeGreaterThanOrEqual(now - 60 * DAY_MS - 1000);
      if (r.readAt) {
        expect(r.readAt.getTime()).toBeGreaterThanOrEqual(r.createdAt.getTime());
        expect(r.readAt.getTime()).toBeLessThanOrEqual(now);
      }
      const links = r.links as { label: string; href: string }[];
      expect(links[0].href).toBe(r.href);
    }

    const unread = new Map<string, number>();
    for (const r of rows.filter((x) => !x.readAt)) unread.set(r.userId, (unread.get(r.userId) ?? 0) + 1);
    expect(Math.max(...unread.values())).toBeGreaterThan(NOTIFICATIONS_PAGE_SIZE);
  });

  it("respecte la portee de chaque notification et n'adresse personne de bloque ou archive", async () => {
    const rows = await prisma.notification.findMany({ include: { user: true } });
    const orgMembers = new Map<string, Set<string>>();
    for (const m of await prisma.orgMembership.findMany()) {
      orgMembers.set(m.orgId, (orgMembers.get(m.orgId) ?? new Set()).add(m.userId));
    }
    const eventMembers = new Map<string, Set<string>>();
    for (const m of await prisma.eventMembership.findMany()) {
      eventMembers.set(m.eventId, (eventMembers.get(m.eventId) ?? new Set()).add(m.userId));
    }
    const owners = new Set((await prisma.orgMembership.findMany({ where: { role: "OWNER" } })).map((m) => `${m.orgId}|${m.userId}`));
    const eventOrg = new Map((await prisma.event.findMany()).map((e) => [e.id, e.orgId]));

    for (const r of rows) {
      expect(r.user.blocked || r.user.archived).toBe(false);
      expect(PRINT_NOTIFICATION_TYPES).not.toContain(r.type);
      if (r.scope === "PLATFORM") expect(r.user.isStaff).toBe(true);
      if (r.scope === "ORG") {
        expect(r.orgId).not.toBeNull();
        expect(orgMembers.get(r.orgId!)?.has(r.userId)).toBe(true);
        if (["SUBSCRIPTION_CHANGED", "SUBSCRIPTION_EXPIRING", "QUOTA_EXCEEDED"].includes(r.type)) {
          expect(owners.has(`${r.orgId}|${r.userId}`)).toBe(true);
        }
      }
      if (r.scope === "EVENT") {
        expect(r.eventId).not.toBeNull();
        expect(r.orgId).toBe(eventOrg.get(r.eventId!));
        const ok = eventMembers.get(r.eventId!)?.has(r.userId) || orgMembers.get(r.orgId!)?.has(r.userId);
        expect(ok).toBe(true);
      }
      if (r.scope === "PARTICIPANT") expect(r.user.isStaff).toBe(false);
    }
  });

  it("relie EMAIL_FAILED aux jobs en echec, SUBSCRIPTION_EXPIRING aux rappels, SUBSCRIPTION_CHANGED aux paiements", async () => {
    const failedIds = new Set((await prisma.job.findMany({ where: { status: "FAILED" } })).map((j) => j.id));
    const rows = await prisma.notification.findMany();
    const emailFailed = rows.filter((r) => r.type === "EMAIL_FAILED");
    expect(emailFailed.length).toBeGreaterThan(0);
    for (const r of emailFailed) {
      expect(r.href!.startsWith("/platform/jobs/")).toBe(true);
      expect(failedIds.has(r.href!.replace("/platform/jobs/", ""))).toBe(true);
    }

    const reminders = await prisma.subscriptionReminder.findMany({ include: { subscription: true } });
    for (const rem of reminders) {
      const owners = await prisma.orgMembership.count({ where: { orgId: rem.subscription.orgId, role: "OWNER" } });
      const got = rows.filter((r) => r.type === "SUBSCRIPTION_EXPIRING" && r.orgId === rem.subscription.orgId && r.createdAt.getTime() === rem.sentAt.getTime());
      expect(got).toHaveLength(owners);
      for (const g of got) expect(g.title).toContain(rem.daysBefore === 1 ? "demain" : `${rem.daysBefore} jours`);
    }
    expect(rows.some((r) => r.type === "SUBSCRIPTION_EXPIRING")).toBe(true);

    const approved = await prisma.payment.findMany({ where: { status: "APPROVED" } });
    for (const p of approved) {
      const platform = rows.filter((r) => r.type === "SUBSCRIPTION_CHANGED" && r.scope === "PLATFORM" && r.orgId === p.orgId);
      expect(platform.length).toBeGreaterThanOrEqual(approved.filter((x) => x.orgId === p.orgId).length);
    }
    expect(rows.some((r) => r.type === "QUOTA_EXCEEDED")).toBe(true);
  });

  it("est idempotent", async () => {
    const before = await prisma.notification.count();
    await run();
    expect(await prisma.notification.count()).toBe(before);
  });
});
