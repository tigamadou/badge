import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { DEMO_PASSWORD, DEV_SUPER_ADMIN_EMAIL } from "../../constants";
import { createDemoContext, type DemoContext } from "../context";
import { seedAccounts } from "../accounts";

const TEST_PREFIX = "demo/_test/";

describe("seedAccounts", () => {
  let ctx: DemoContext;

  beforeEach(async () => {
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
  });

  afterEach(async () => {
    await ctx.storage.clearTracked();
  });

  it("couvre les 4 roles staff, au moins 2 comptes sauf SUPER_ADMIN, tous verifies", async () => {
    const { staff } = ctx.registry;
    expect(Object.keys(staff).sort()).toEqual(["STAFF_ADMIN", "STAFF_OBSERVER", "STAFF_PRINTER", "STAFF_SUPPORT", "SUPER_ADMIN"]);
    for (const role of ["STAFF_ADMIN", "STAFF_SUPPORT", "STAFF_OBSERVER"] as const) {
      expect(staff[role].length).toBeGreaterThanOrEqual(2);
    }
    const emails = (r: keyof typeof staff) => staff[r].map((u) => u.email);
    expect(emails("SUPER_ADMIN")).toEqual(expect.arrayContaining([DEV_SUPER_ADMIN_EMAIL, "admin2@badge.local"]));
    expect(emails("STAFF_ADMIN")).toContain("staff-admin.2@demo.local");
    expect(emails("STAFF_SUPPORT")).toEqual(expect.arrayContaining(["support@badge.local", "support.2@demo.local"]));
    expect(emails("STAFF_OBSERVER")).toEqual(expect.arrayContaining(["observer@badge.local", "observer@demo.local"]));

    for (const [role, users] of Object.entries(staff)) {
      for (const u of users) {
        const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, include: { platformRole: true } });
        if (role === "STAFF_PRINTER") expect(row.staffRole).toBeNull();
        else expect(row.staffRole).toBe(role);
        if (u.email !== DEV_SUPER_ADMIN_EMAIL) expect(row.platformRole?.systemKey).toBe(role);
        expect(row.isStaff).toBe(true);
        expect(row.emailVerifiedAt).not.toBeNull();
      }
    }
  });

  it("cree un compte Imprimeur plateforme et un compte Agent d'organisation", async () => {
    const printer = await prisma.user.findUniqueOrThrow({
      where: { email: "printer@demo.local" },
      include: { platformRole: true },
    });
    expect(printer.isStaff).toBe(true);
    expect(printer.staffRole).toBeNull();
    expect(printer.platformRole?.systemKey).toBe("STAFF_PRINTER");
    expect(ctx.registry.staff.STAFF_PRINTER.map((u) => u.email)).toEqual(["printer@demo.local"]);

    const agent = ctx.registry.pendingOrgMembers.find((m) => m.role === "AGENT");
    expect(agent?.user.email).toBe("agent.grosse-org@demo.local");
    expect(agent?.orgSlug).toBe("demo-grosse-org");
  });

  it("cree les cas particuliers de compte", async () => {
    const sp = ctx.registry.special;
    const get = (k: keyof typeof sp) => prisma.user.findUniqueOrThrow({ where: { id: sp[k]!.id } });

    const pending = await get("invitationPending");
    expect(pending.inviteToken).toMatch(/^[0-9a-f]{64}$/);
    expect(pending.inviteTokenExpiry!.getTime()).toBeGreaterThan(Date.now());
    expect(pending.emailVerifiedAt).toBeNull();

    const expired = await get("invitationExpired");
    expect(expired.inviteToken).not.toBeNull();
    expect(expired.inviteTokenExpiry!.getTime()).toBeLessThan(Date.now());

    const accepted = await get("invitationAccepted");
    expect(accepted.inviteToken).toBeNull();
    expect(accepted.emailVerifiedAt).not.toBeNull();
    expect(accepted.lastLoginAt).not.toBeNull();

    const blocked = await get("blocked");
    expect(blocked.blocked).toBe(true);
    expect(blocked.blockedReason).toBeTruthy();

    const unverified = await get("unverifiedEmail");
    expect(unverified.emailVerifiedAt).toBeNull();
    expect(unverified.emailVerifyToken).toBeTruthy();

    const archived = await get("archivedUser");
    expect(archived.archived).toBe(true);
    expect(archived.archivedAt).not.toBeNull();

    // les invitations ne sont pas des comptes staff utilisables
    const staffIds = Object.values(ctx.registry.staff).flat().map((u) => u.id);
    expect(staffIds).not.toContain(sp.invitationPending!.id);
  });

  it("prepare les rattachements d'organisation et d'evenement", () => {
    const { pendingOrgMembers: orgs, pendingEventMembers: events, special } = ctx.registry;
    expect(new Set(orgs.map((m) => m.role))).toEqual(new Set(["OWNER", "MANAGER", "AUDITOR", "AGENT"]));
    const grosseOwners = orgs.filter((m) => m.orgSlug === "demo-grosse-org" && m.role === "OWNER");
    expect(new Set(grosseOwners.map((m) => m.user.id)).size).toBe(2);
    expect(orgs.filter((m) => m.user.id === special.multiOrg!.id).map((m) => m.orgSlug)).toHaveLength(2);
    expect(new Set(orgs.filter((m) => m.user.id === special.multiOrg!.id).map((m) => m.orgSlug)).size).toBe(2);
    expect(orgs.some((m) => m.user.id === special.organizerAndParticipant!.id)).toBe(true);
    expect(new Set(events.map((m) => m.role))).toEqual(new Set(["ADMIN", "OPERATOR", "PRINTER", "VIEWER"]));
    // couples uniques
    const keys = orgs.map((m) => `${m.user.id}|${m.orgSlug}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const m of [...orgs, ...events]) expect(m.orgSlug.startsWith("demo-")).toBe(true);
  });

  it("l'organisateur participant a un profil valide", async () => {
    const user = ctx.registry.special.organizerAndParticipant!;
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.profileStatus).toBe("APPROVED");
    const last = await prisma.profileSubmission.findFirstOrThrow({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    expect(last.status).toBe("APPROVED");
    expect(ctx.registry.participants.map((p) => p.id)).toContain(user.id);
  });

  it("mot de passe commun, emails au format convenu, comptes enregistres", async () => {
    const users = await prisma.user.findMany({ where: { email: { endsWith: "@demo.local" } } });
    expect(users.length).toBeGreaterThan(15);
    for (const u of users) {
      expect(u.password).toBe(ctx.passwordHash);
      expect(u.email).toMatch(/^[a-z]+([.-][a-z0-9-]+)*@demo\.local$/);
    }
    const admin2 = await prisma.user.findUniqueOrThrow({ where: { email: "admin2@badge.local" } });
    expect(admin2.password).toBe(ctx.passwordHash);
    expect(await compare(DEMO_PASSWORD, ctx.passwordHash)).toBe(true);

    const recorded = new Set(ctx.accounts.map((a) => a.email));
    for (const u of users) expect(recorded.has(u.email)).toBe(true);
    expect(recorded.has(DEV_SUPER_ADMIN_EMAIL)).toBe(true);
    for (const a of ctx.accounts) {
      expect(a.role).toBeTruthy();
      expect(a.scenario.length).toBeGreaterThan(5);
    }
  });

  it("ne plante pas sans admin@badge.local", async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@demo.local" } } });
    await prisma.user.deleteMany({ where: { email: { in: ["admin2@badge.local", "support@badge.local", "observer@badge.local", DEV_SUPER_ADMIN_EMAIL] } } });
    const fresh = await createDemoContext({ env: { BADGE_ENV: "dev" }, scale: 0.02, storagePrefix: TEST_PREFIX });
    await seedAccounts(fresh);
    expect(fresh.registry.staff.SUPER_ADMIN.map((u) => u.email)).toEqual(["admin2@badge.local"]);
  });
});
