import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getFile, deletePrefix } from "@/lib/storage";
import { DEMO_PASSWORD, DEV_SUPER_ADMIN_EMAIL } from "../../constants";
import { createDemoContext, type DemoContext } from "../context";
import { seedAccounts } from "../accounts";
import { seedOrganizationsAndEvents } from "../organizations";
import { installDemoTemplate } from "../templates";

const TEST_PREFIX = "demo/_test/";

async function cleanTemplates() {
  const rows = await prisma.installedBadgeTemplate.findMany({
    where: { family: { startsWith: "demo-" } },
    select: { id: true, assetPrefix: true },
  });
  await prisma.installedBadgeTemplate.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  for (const r of rows) await deletePrefix(r.assetPrefix);
}

describe("seedOrganizationsAndEvents", () => {
  let ctx: DemoContext;

  beforeEach(async () => {
    await cleanTemplates();
    await prisma.user.create({
      data: {
        email: DEV_SUPER_ADMIN_EMAIL,
        password: await hash(DEMO_PASSWORD, 4),
        name: "Super Admin",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
        emailVerifiedAt: new Date(),
      },
    });
    ctx = await createDemoContext({ env: { BADGE_ENV: "dev" }, scale: 0.02, storagePrefix: TEST_PREFIX });
    await seedAccounts(ctx);
    await seedOrganizationsAndEvents(ctx);
  });

  afterEach(async () => {
    await cleanTemplates();
    await ctx.storage.clearTracked();
  });

  it("cree 12 organisations par taille, avec logos existants", async () => {
    const { orgsBySize, orgs } = ctx.registry;
    expect(orgs).toHaveLength(12);
    expect(orgsBySize.huge.map((o) => o.slug)).toEqual(["demo-grosse-org"]);
    expect(orgsBySize.medium).toHaveLength(4);
    expect(orgsBySize.small).toHaveLength(6);
    expect(orgsBySize.archived.map((o) => o.slug)).toEqual(["demo-archivee"]);
    expect(await prisma.organization.count({ where: { slug: { startsWith: "demo-" } } })).toBe(12);

    const archived = await prisma.organization.findUniqueOrThrow({ where: { slug: "demo-archivee" } });
    expect(archived.archived).toBe(true);
    expect(archived.archivedAt).not.toBeNull();

    for (const o of await prisma.organization.findMany()) {
      expect(ctx.images.logos).toContain(o.logo);
      expect((await getFile(o.logo!)).body.length).toBeGreaterThan(0);
    }
  });

  it("repartit les evenements par phase avec des dates relatives", async () => {
    const { events, eventsByPhase, eventsByOrg, orgsBySize } = ctx.registry;
    const now = ctx.dates.now.getTime();
    expect(eventsByOrg.get(orgsBySize.huge[0].id)!.length).toBeGreaterThan(1);
    for (const o of orgsBySize.huge.concat(orgsBySize.medium, orgsBySize.small)) {
      expect(new Set(eventsByOrg.get(o.id)!.map((e) => e.phase)).size).toBeGreaterThanOrEqual(2);
    }
    for (const phase of ["past", "ongoing", "upcoming"] as const) expect(eventsByPhase[phase].length).toBeGreaterThan(0);

    for (const e of events) {
      const row = await prisma.event.findUniqueOrThrow({ where: { id: e.id } });
      if (e.phase === "past") expect(row.date.getTime()).toBeLessThan(now);
      if (e.phase === "ongoing") {
        expect(row.date.getTime()).toBeLessThanOrEqual(now);
        expect(row.endDate!.getTime()).toBeGreaterThanOrEqual(now);
      }
      if (e.phase === "upcoming") expect(row.date.getTime()).toBeGreaterThan(now);
      expect(row.registrationOpen).toBe(e.phase !== "past" && !e.archived && !orgsBySize.archived.some((o) => o.id === e.orgId));
      if (row.archived) {
        expect(row.archivedAt).not.toBeNull();
        expect(e.phase).toBe("past");
      }
    }
    const archivedOrgEvents = events.filter((e) => e.orgId === orgsBySize.archived[0].id);
    expect(archivedOrgEvents.length).toBeGreaterThan(0);
    for (const e of archivedOrgEvents) expect(e.registrationOpen).toBe(false);
    expect(events.some((e) => e.archived)).toBe(true);
  });

  it("cree les categories, modeles de categorie, blocages et reglages", async () => {
    const { events, orgs } = ctx.registry;
    let anonymous = 0;
    let neutral = 0;
    for (const e of events) {
      expect(e.categories.length).toBeGreaterThanOrEqual(2);
      expect(e.categories.length).toBeLessThanOrEqual(4);
      expect(e.categories.some((c) => !c.anonymous && !c.neutralBadge)).toBe(true);
      const numbers = e.categories.map((c) => c.number);
      expect(new Set(numbers).size).toBe(numbers.length);
      expect(new Set(numbers.map((n) => n % 10)).size).toBe(numbers.length);
      anonymous += e.categories.filter((c) => c.anonymous).length;
      neutral += e.categories.filter((c) => c.neutralBadge).length;
      const db = await prisma.category.count({ where: { eventId: e.id } });
      expect(db).toBe(e.categories.length);
    }
    expect(anonymous).toBeGreaterThan(0);
    expect(neutral).toBeGreaterThan(0);
    for (const o of orgs) expect(await prisma.categoryTemplate.count({ where: { orgId: o.id } })).toBeGreaterThan(0);

    const active = events.filter((e) => !e.archived).map((e) => e.id);
    expect(await prisma.blockedEmail.count({ where: { eventId: { in: active } } })).toBeGreaterThan(0);
    expect(await prisma.blockedDocument.count({ where: { eventId: { in: active } } })).toBeGreaterThan(0);
    const settings = await prisma.eventSettings.count();
    expect(settings).toBeGreaterThan(0);
    expect(settings).toBeLessThan(events.length);
  });

  it("renseigne logo, banniere, description et consignes sur certains evenements", async () => {
    const rows = await prisma.event.findMany();
    expect(rows.every((r) => r.description && r.location)).toBe(true);
    expect(rows.some((r) => r.banner)).toBe(true);
    expect(rows.some((r) => !r.banner)).toBe(true);
    expect(rows.some((r) => r.logo)).toBe(true);
    expect(rows.some((r) => r.endDate)).toBe(true);
    expect(rows.some((r) => Array.isArray(r.securityInstructions) && r.securityInstructions.length > 0)).toBe(true);
    for (const r of rows) {
      if (r.logo) expect(ctx.images.logos).toContain(r.logo);
      if (r.banner) expect(ctx.images.banners).toContain(r.banner);
    }
  });

  it("pointe des templates demo installes depuis l'organisation et l'evenement", async () => {
    const installed = await prisma.installedBadgeTemplate.findMany({ where: { family: { startsWith: "demo-" } } });
    expect(installed.length).toBeGreaterThanOrEqual(2);
    const ids = new Set(installed.map((i) => i.id));
    const orgs = await prisma.organization.findMany({ where: { badgeTemplateId: { not: null } } });
    const events = await prisma.event.findMany({ where: { badgeTemplateId: { not: null } } });
    expect(orgs.length).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);
    for (const r of [...orgs, ...events]) expect(ids.has(r.badgeTemplateId!)).toBe(true);
    const demoOrg = ctx.registry.orgs.find((o) => o.badgeTemplateId);
    expect(demoOrg).toBeDefined();
  });

  it("materialise tous les rattachements prevus", async () => {
    const { pendingOrgMembers, pendingEventMembers, orgs, eventsByOrg } = ctx.registry;
    for (const m of pendingOrgMembers) {
      const org = orgs.find((o) => o.slug === m.orgSlug)!;
      const row = await prisma.orgMembership.findUnique({
        where: { userId_orgId: { userId: m.user.id, orgId: org.id } },
        include: { roleRef: true },
      });
      // roleId pour tous ; colonne d'enum seulement pour les roles herites (AGENT n'en a pas)
      expect(row?.roleRef?.systemKey).toBe(m.role);
      expect(row?.role).toBe(m.role === "AGENT" ? null : m.role);
    }
    for (const m of pendingEventMembers) {
      const org = orgs.find((o) => o.slug === m.orgSlug)!;
      expect(org.archived).toBe(false);
      const evIds = eventsByOrg.get(org.id)!.map((e) => e.id);
      const rows = await prisma.eventMembership.findMany({
        where: { userId: m.user.id, eventId: { in: evIds }, role: m.role },
        include: { roleRef: true },
      });
      expect(rows.length).toBeGreaterThanOrEqual(1);
      for (const r of rows) expect(r.roleRef?.systemKey).toBe(m.role);
      if (m.phase !== "any") {
        const phases = rows.map((r) => eventsByOrg.get(org.id)!.find((e) => e.id === r.eventId)!.phase);
        expect(phases).toContain(m.phase);
      }
    }
    expect(await prisma.orgMembership.count()).toBe(new Set(pendingOrgMembers.map((m) => `${m.user.id}|${m.orgSlug}`)).size);
    expect(ctx.registry.orgMembers.size).toBeGreaterThan(0);
    expect(ctx.registry.eventMembers.size).toBeGreaterThan(0);
  });
});

describe("installDemoTemplate", () => {
  let ctx: DemoContext;

  beforeEach(async () => {
    await cleanTemplates();
    await prisma.user.create({
      data: {
        email: DEV_SUPER_ADMIN_EMAIL,
        password: await hash(DEMO_PASSWORD, 4),
        name: "Super Admin",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
        emailVerifiedAt: new Date(),
      },
    });
    ctx = await createDemoContext({ env: { BADGE_ENV: "dev" }, scale: 0.02, storagePrefix: TEST_PREFIX });
  });

  afterEach(async () => {
    await cleanTemplates();
    await ctx.storage.clearTracked();
  });

  it("deux familles differentes creent deux lignes distinctes", async () => {
    const a = await installDemoTemplate(ctx, { family: "demo-a", label: "Demo A", source: "default" });
    const b = await installDemoTemplate(ctx, { family: "demo-b", label: "Demo B", source: "recto-verso" });
    expect(a).not.toBe(b);
    const rows = await prisma.installedBadgeTemplate.findMany({ where: { id: { in: [a, b] } } });
    expect(rows.map((r) => r.family).sort()).toEqual(["demo-a", "demo-b"]);
    expect(rows.find((r) => r.id === a)!.label).toBe("Demo A");
    expect(rows.find((r) => r.id === b)!.pages).toBeGreaterThanOrEqual(2);
  });

  it("refuse une famille hors du prefixe demo-", async () => {
    await expect(installDemoTemplate(ctx, { family: "default", label: "x", source: "default" })).rejects.toThrow(/demo-/);
  });
});
