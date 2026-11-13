import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  requireStaff,
  requireOrgRole,
  requireEventRole,
  requireEventPermission,
  getEffectiveEventRole,
  assertNotLastOwner,
  assertNotLastSuperAdmin,
  requirePermission,
  loadPermissions,
  loadEventTarget,
  AuthError,
} from "@/lib/auth-guards";
import type { SystemRoleKey } from "@/lib/permissions";
import { SYSTEM_ROLES } from "@/lib/permissions";
import { makeEvent, makeOrg, makeStaff, makeUser } from "@/test/factories";

async function setupOrgEvent() {
  const org = await prisma.organization.create({
    data: { name: "O", slug: `o-${Date.now()}-${Math.random()}` },
  });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "E",
      slug: `e-${Date.now()}-${Math.random()}`,
      location: "",
      date: new Date(),
    },
  });
  return { org, event };
}

async function resetAll() {
  await prisma.activityLog.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

describe("requireStaff", () => {
  beforeEach(resetAll);

  it("throws AuthError if user not found", async () => {
    await expect(requireStaff("missing", "STAFF_OBSERVER")).rejects.toBeInstanceOf(AuthError);
  });

  it("throws if user is not staff", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await expect(requireStaff(u.id, "STAFF_OBSERVER")).rejects.toBeInstanceOf(AuthError);
  });

  it("requireStaff(SUPER_ADMIN) accepts a SUPER_ADMIN", async () => {
    const u = await prisma.user.create({
      data: { email: "sa@x", password: "x", name: "SA", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await expect(requireStaff(u.id, "SUPER_ADMIN")).resolves.toBeUndefined();
  });

  it("requireStaff(SUPER_ADMIN) rejects a STAFF_ADMIN", async () => {
    const u = await prisma.user.create({
      data: { email: "a@x", password: "x", name: "A", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await expect(requireStaff(u.id, "SUPER_ADMIN")).rejects.toBeInstanceOf(AuthError);
  });

  it("requireStaff(STAFF_ADMIN) accepts a SUPER_ADMIN", async () => {
    const u = await prisma.user.create({
      data: { email: "sa2@x", password: "x", name: "SA", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await expect(requireStaff(u.id, "STAFF_ADMIN")).resolves.toBeUndefined();
  });

  it("requireStaff(STAFF_ADMIN) accepts a STAFF_ADMIN", async () => {
    const u = await prisma.user.create({
      data: { email: "a2@x", password: "x", name: "A", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await expect(requireStaff(u.id, "STAFF_ADMIN")).resolves.toBeUndefined();
  });

  it("passes for STAFF_ADMIN when STAFF_SUPPORT required", async () => {
    const u = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await expect(requireStaff(u.id, "STAFF_SUPPORT")).resolves.toBeUndefined();
  });

  it("throws for STAFF_OBSERVER when STAFF_ADMIN required", async () => {
    const u = await prisma.user.create({
      data: { email: "o@x", password: "x", name: "O", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    await expect(requireStaff(u.id, "STAFF_ADMIN")).rejects.toBeInstanceOf(AuthError);
  });
});

describe("requireOrgRole", () => {
  beforeEach(resetAll);

  it("requireOrgRole(OWNER) accepts OWNER, rejects MANAGER and AUDITOR", async () => {
    const { org } = await setupOrgEvent();
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const mgr = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
    const aud = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    await prisma.orgMembership.create({ data: { userId: mgr.id, orgId: org.id, role: "MANAGER" } });
    await prisma.orgMembership.create({ data: { userId: aud.id, orgId: org.id, role: "AUDITOR" } });

    await expect(requireOrgRole(owner.id, org.id, "OWNER")).resolves.toBeUndefined();
    await expect(requireOrgRole(mgr.id, org.id, "OWNER")).rejects.toBeInstanceOf(AuthError);
    await expect(requireOrgRole(aud.id, org.id, "OWNER")).rejects.toBeInstanceOf(AuthError);
  });

  it("requireOrgRole(MANAGER) accepts OWNER and MANAGER, rejects AUDITOR", async () => {
    const { org } = await setupOrgEvent();
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const mgr = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
    const aud = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    await prisma.orgMembership.create({ data: { userId: mgr.id, orgId: org.id, role: "MANAGER" } });
    await prisma.orgMembership.create({ data: { userId: aud.id, orgId: org.id, role: "AUDITOR" } });

    await expect(requireOrgRole(owner.id, org.id, "MANAGER")).resolves.toBeUndefined();
    await expect(requireOrgRole(mgr.id, org.id, "MANAGER")).resolves.toBeUndefined();
    await expect(requireOrgRole(aud.id, org.id, "MANAGER")).rejects.toBeInstanceOf(AuthError);
  });

  it("requireOrgRole(AUDITOR) accepts all three org roles", async () => {
    const { org } = await setupOrgEvent();
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const mgr = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
    const aud = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    await prisma.orgMembership.create({ data: { userId: mgr.id, orgId: org.id, role: "MANAGER" } });
    await prisma.orgMembership.create({ data: { userId: aud.id, orgId: org.id, role: "AUDITOR" } });

    await expect(requireOrgRole(owner.id, org.id, "AUDITOR")).resolves.toBeUndefined();
    await expect(requireOrgRole(mgr.id, org.id, "AUDITOR")).resolves.toBeUndefined();
    await expect(requireOrgRole(aud.id, org.id, "AUDITOR")).resolves.toBeUndefined();
  });

  it("passes for staff (bypass)", async () => {
    const { org } = await setupOrgEvent();
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_SUPPORT" },
    });
    await expect(requireOrgRole(s.id, org.id, "OWNER")).resolves.toBeUndefined();
  });

  it("throws for non-member, non-staff", async () => {
    const { org } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "x@x", password: "x", name: "X" } });
    await expect(requireOrgRole(u.id, org.id, "AUDITOR")).rejects.toBeInstanceOf(AuthError);
  });
});

describe("requireEventRole", () => {
  beforeEach(resetAll);

  it("passes for OWNER of parent org when ADMIN required (heritage)", async () => {
    const { org, event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await expect(requireEventRole(u.id, event.id, "ADMIN")).resolves.toBeUndefined();
  });

  it("passes for MANAGER of parent org when ADMIN required (heritage symetrique)", async () => {
    const { org, event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "MANAGER" } });
    await expect(requireEventRole(u.id, event.id, "ADMIN")).resolves.toBeUndefined();
  });

  it("AUDITOR of parent org is VIEWER on event, refused on ADMIN/OPERATOR/PRINTER", async () => {
    const { org, event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "AUDITOR" } });
    await expect(requireEventRole(u.id, event.id, "VIEWER")).resolves.toBeUndefined();
    await expect(requireEventRole(u.id, event.id, "ADMIN")).rejects.toBeInstanceOf(AuthError);
    await expect(requireEventRole(u.id, event.id, "OPERATOR")).rejects.toBeInstanceOf(AuthError);
    await expect(requireEventRole(u.id, event.id, "PRINTER")).rejects.toBeInstanceOf(AuthError);
  });

  it("passes for explicit ADMIN membership", async () => {
    const { event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
    await expect(requireEventRole(u.id, event.id, "ADMIN")).resolves.toBeUndefined();
  });

  it("PRINTER refuses VIEWER and inversement (disjonction)", async () => {
    const { event: e1 } = await setupOrgEvent();
    const { event: e2 } = await setupOrgEvent();
    const printer = await prisma.user.create({ data: { email: "p@x", password: "x", name: "P" } });
    const viewer = await prisma.user.create({ data: { email: "v@x", password: "x", name: "V" } });
    await prisma.eventMembership.create({ data: { userId: printer.id, eventId: e1.id, role: "PRINTER" } });
    await prisma.eventMembership.create({ data: { userId: viewer.id, eventId: e2.id, role: "VIEWER" } });

    await expect(requireEventRole(printer.id, e1.id, "VIEWER")).rejects.toBeInstanceOf(AuthError);
    await expect(requireEventRole(viewer.id, e2.id, "PRINTER")).rejects.toBeInstanceOf(AuthError);
  });

  it("getEffectiveEventRole returns STAFF for staff", async () => {
    const { event } = await setupOrgEvent();
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    expect(await getEffectiveEventRole(s.id, event.id)).toBe("STAFF");
  });

  it("getEffectiveEventRole returns null when the user does not exist", async () => {
    const { event } = await setupOrgEvent();
    expect(await getEffectiveEventRole("missing-user", event.id)).toBeNull();
  });

  it("getEffectiveEventRole returns null when the event does not exist", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    expect(await getEffectiveEventRole(u.id, "missing-event")).toBeNull();
  });
});

describe("requireEventPermission", () => {
  beforeEach(resetAll);

  it("badge.print accepted for ADMIN, OPERATOR, PRINTER ; refused for VIEWER", async () => {
    const { event } = await setupOrgEvent();
    const admin = await prisma.user.create({ data: { email: "ad@x", password: "x", name: "A" } });
    const op = await prisma.user.create({ data: { email: "op@x", password: "x", name: "O" } });
    const pr = await prisma.user.create({ data: { email: "pr@x", password: "x", name: "P" } });
    const vw = await prisma.user.create({ data: { email: "vw@x", password: "x", name: "V" } });
    await prisma.eventMembership.create({ data: { userId: admin.id, eventId: event.id, role: "ADMIN" } });
    await prisma.eventMembership.create({ data: { userId: op.id, eventId: event.id, role: "OPERATOR" } });
    await prisma.eventMembership.create({ data: { userId: pr.id, eventId: event.id, role: "PRINTER" } });
    await prisma.eventMembership.create({ data: { userId: vw.id, eventId: event.id, role: "VIEWER" } });

    await expect(requireEventPermission(admin.id, event.id, "badge.print")).resolves.toBeUndefined();
    await expect(requireEventPermission(op.id, event.id, "badge.print")).resolves.toBeUndefined();
    await expect(requireEventPermission(pr.id, event.id, "badge.print")).resolves.toBeUndefined();
    await expect(requireEventPermission(vw.id, event.id, "badge.print")).rejects.toBeInstanceOf(AuthError);
  });

  it("scan.check-in refused for PRINTER (cas piege)", async () => {
    const { event } = await setupOrgEvent();
    const pr = await prisma.user.create({ data: { email: "pr2@x", password: "x", name: "P" } });
    await prisma.eventMembership.create({ data: { userId: pr.id, eventId: event.id, role: "PRINTER" } });
    await expect(requireEventPermission(pr.id, event.id, "scan.check-in")).rejects.toBeInstanceOf(AuthError);
  });

  it("event.read.aggregated accepted for VIEWER ; refused for PRINTER", async () => {
    const { event } = await setupOrgEvent();
    const pr = await prisma.user.create({ data: { email: "pr3@x", password: "x", name: "P" } });
    const vw = await prisma.user.create({ data: { email: "vw3@x", password: "x", name: "V" } });
    await prisma.eventMembership.create({ data: { userId: pr.id, eventId: event.id, role: "PRINTER" } });
    await prisma.eventMembership.create({ data: { userId: vw.id, eventId: event.id, role: "VIEWER" } });
    await expect(requireEventPermission(vw.id, event.id, "event.read.aggregated")).resolves.toBeUndefined();
    await expect(requireEventPermission(pr.id, event.id, "event.read.aggregated")).rejects.toBeInstanceOf(AuthError);
  });

  it("AUDITOR of parent org : aggregated accepted, detailed refused", async () => {
    const { org, event } = await setupOrgEvent();
    const u = await prisma.user.create({ data: { email: "ad@x", password: "x", name: "AUD" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "AUDITOR" } });
    await expect(requireEventPermission(u.id, event.id, "event.read.aggregated")).resolves.toBeUndefined();
    await expect(requireEventPermission(u.id, event.id, "event.read.detailed")).rejects.toBeInstanceOf(AuthError);
  });

  it("staff bypass on any permission", async () => {
    const { event } = await setupOrgEvent();
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    await expect(requireEventPermission(s.id, event.id, "registration.delete")).resolves.toBeUndefined();
  });

  it("throws NOT_AUTHENTICATED when the user does not exist", async () => {
    const { event } = await setupOrgEvent();
    await expect(
      requireEventPermission("missing-user", event.id, "badge.print"),
    ).rejects.toMatchObject({ code: "NOT_AUTHENTICATED", httpStatus: 401 });
  });

  it("throws EVENT_NOT_FOUND when the event does not exist", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await expect(
      requireEventPermission(u.id, "missing-event", "badge.print"),
    ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND", httpStatus: 404 });
  });
});

describe("assertNotLastOwner", () => {
  beforeEach(resetAll);

  it("rejects if removing the last active OWNER of a non-archived org", async () => {
    const { org } = await setupOrgEvent();
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });

    await expect(assertNotLastOwner(org.id, owner.id)).rejects.toMatchObject({ code: "LAST_OWNER" });
  });

  it("accepts if another active OWNER remains", async () => {
    const { org } = await setupOrgEvent();
    const o1 = await prisma.user.create({ data: { email: "o1@x", password: "x", name: "O1" } });
    const o2 = await prisma.user.create({ data: { email: "o2@x", password: "x", name: "O2" } });
    await prisma.orgMembership.create({ data: { userId: o1.id, orgId: org.id, role: "OWNER" } });
    await prisma.orgMembership.create({ data: { userId: o2.id, orgId: org.id, role: "OWNER" } });

    await expect(assertNotLastOwner(org.id, o1.id)).resolves.toBeUndefined();
  });

  it("MANAGER does not count as fallback (must be OWNER)", async () => {
    const { org } = await setupOrgEvent();
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const mgr = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    await prisma.orgMembership.create({ data: { userId: mgr.id, orgId: org.id, role: "MANAGER" } });

    await expect(assertNotLastOwner(org.id, owner.id)).rejects.toMatchObject({ code: "LAST_OWNER" });
  });

  it("does not block when the org itself is archived", async () => {
    const { org } = await setupOrgEvent();
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
    await prisma.organization.update({ where: { id: org.id }, data: { archived: true } });

    await expect(assertNotLastOwner(org.id, owner.id)).resolves.toBeUndefined();
  });
});

describe("assertNotLastSuperAdmin", () => {
  beforeEach(resetAll);

  it("rejects if removing the SUPER_ADMIN of the only user holding it", async () => {
    const u = await prisma.user.create({
      data: { email: "sa@x", password: "x", name: "SA", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await expect(assertNotLastSuperAdmin(u.id)).rejects.toMatchObject({ code: "LAST_SUPER_ADMIN" });
  });

  it("accepts if another active SUPER_ADMIN remains", async () => {
    const u1 = await prisma.user.create({
      data: { email: "sa1@x", password: "x", name: "SA1", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await prisma.user.create({
      data: { email: "sa2@x", password: "x", name: "SA2", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await expect(assertNotLastSuperAdmin(u1.id)).resolves.toBeUndefined();
  });
});

describe("guards - branches d'entree (contexte / event manquants)", () => {
  beforeEach(resetAll);

  it("requireOrgRole rejette NOT_AUTHENTICATED si le user n'existe pas", async () => {
    await expect(requireOrgRole("ghost-user", "any-org", "AUDITOR")).rejects.toMatchObject({
      code: "NOT_AUTHENTICATED",
      httpStatus: 401,
    });
  });

  it("requireEventRole rejette NOT_AUTHENTICATED si le user n'existe pas", async () => {
    await expect(requireEventRole("ghost-user", "any-event", "VIEWER")).rejects.toMatchObject({
      code: "NOT_AUTHENTICATED",
      httpStatus: 401,
    });
  });

  it("requireEventRole rejette EVENT_NOT_FOUND si l'event n'existe pas", async () => {
    const user = await prisma.user.create({
      data: { email: `ev-nf-${Date.now()}@x.fr`, password: "x", name: "U" },
    });
    await expect(requireEventRole(user.id, "no-such-event", "VIEWER")).rejects.toMatchObject({
      code: "EVENT_NOT_FOUND",
      httpStatus: 404,
    });
  });
});

// Role systeme ecrit en base (les roles sont effaces entre deux tests par le setup global).
async function sysRoleId(key: SystemRoleKey): Promise<string> {
  const def = SYSTEM_ROLES[key];
  const r = await prisma.role.upsert({
    where: { systemKey: key },
    update: {},
    create: { systemKey: key, scope: def.scope, name: def.name },
  });
  return r.id;
}

describe("requirePermission", () => {
  beforeEach(resetAll);

  it("401 NOT_AUTHENTICATED si le contexte est nul", async () => {
    await expect(
      requirePermission("missing", "event.read.aggregated", { kind: "platform" }),
    ).rejects.toMatchObject({ code: "NOT_AUTHENTICATED", httpStatus: 401 });
  });

  it("403 PERMISSION_DENIED si la permission est absente", async () => {
    const u = await makeUser();
    await expect(
      requirePermission(u.id, "event.read.aggregated", { kind: "platform" }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED", httpStatus: 403 });
  });

  it("resout si la permission est presente", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const staff = await makeStaff("STAFF_ADMIN");
    await expect(
      requirePermission(staff.id, "registration.delete", { kind: "event", eventId: event.id, orgId: org.id }),
    ).resolves.toBeUndefined();
  });

  it("STAFF_OBSERVER refuse sur registration.delete, accepte sur event.read.aggregated", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const obs = await makeStaff("STAFF_OBSERVER");
    const target = { kind: "event", eventId: event.id, orgId: org.id } as const;
    await expect(requirePermission(obs.id, "registration.delete", target)).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
    await expect(requirePermission(obs.id, "event.read.aggregated", target)).resolves.toBeUndefined();
  });

  it("liste : satisfaite par la seconde cle seulement", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const obs = await makeStaff("STAFF_OBSERVER");
    const target = { kind: "event", eventId: event.id, orgId: org.id } as const;
    await expect(
      requirePermission(obs.id, ["registration.delete", "event.read.aggregated"], target),
    ).resolves.toBeUndefined();
  });

  it("liste : aucune cle satisfaite -> PERMISSION_DENIED", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const obs = await makeStaff("STAFF_OBSERVER");
    const target = { kind: "event", eventId: event.id, orgId: org.id } as const;
    await expect(
      requirePermission(obs.id, ["registration.delete", "registration.create"], target),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED", httpStatus: 403 });
  });
});

describe("loadPermissions", () => {
  beforeEach(resetAll);

  it("renvoie l'ensemble des permissions effectives", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const obs = await makeStaff("STAFF_OBSERVER");
    const perms = await loadPermissions(obs.id, { kind: "event", eventId: event.id, orgId: org.id });
    expect(perms.size).toBeGreaterThan(0);
    expect(perms.has("event.read.aggregated")).toBe(true);
    expect(perms.has("registration.delete")).toBe(false);
  });

  it("Set vide pour un utilisateur inconnu", async () => {
    const perms = await loadPermissions("missing", { kind: "platform" });
    expect(perms.size).toBe(0);
  });
});

describe("loadEventTarget", () => {
  beforeEach(resetAll);

  it("404 EVENT_NOT_FOUND si l'evenement est absent", async () => {
    await expect(loadEventTarget("missing")).rejects.toMatchObject({ code: "EVENT_NOT_FOUND", httpStatus: 404 });
  });

  it("renvoie la cible evenement", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    await expect(loadEventTarget(event.id)).resolves.toEqual({ kind: "event", eventId: event.id, orgId: org.id });
  });
});

describe("compatibilite : roles sans equivalent herite", () => {
  beforeEach(resetAll);

  it("STAFF_PRINTER (roleId) est refuse par requireStaff(STAFF_OBSERVER)", async () => {
    const u = await makeUser({ isStaff: true, platformRoleId: await sysRoleId("STAFF_PRINTER") });
    await expect(requireStaff(u.id, "STAFF_OBSERVER")).rejects.toMatchObject({ code: "NOT_STAFF" });
  });

  it("STAFF_PRINTER (roleId) est refuse par requireOrgRole(AUDITOR) meme avec allowStaff", async () => {
    const org = await makeOrg();
    const u = await makeUser({ isStaff: true, platformRoleId: await sysRoleId("STAFF_PRINTER") });
    await expect(requireOrgRole(u.id, org.id, "AUDITOR")).rejects.toMatchObject({ code: "ORG_FORBIDDEN" });
  });

  it("un membre AGENT est refuse par requireOrgRole(AUDITOR) et n'a pas de role d'evenement effectif", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const u = await makeUser();
    await prisma.orgMembership.create({
      data: { userId: u.id, orgId: org.id, roleId: await sysRoleId("AGENT") },
    });
    await expect(requireOrgRole(u.id, org.id, "AUDITOR")).rejects.toMatchObject({ code: "ORG_FORBIDDEN" });
    await expect(getEffectiveEventRole(u.id, event.id)).resolves.toBeNull();
  });
});

describe("derniers titulaires : roleId ou colonne d'enum", () => {
  beforeEach(resetAll);

  it("un OWNER via roleId seul compte", async () => {
    const org = await makeOrg();
    const a = await makeUser();
    const b = await makeUser();
    const ownerId = await sysRoleId("OWNER");
    await prisma.orgMembership.create({ data: { userId: a.id, orgId: org.id, roleId: ownerId } });
    await prisma.orgMembership.create({ data: { userId: b.id, orgId: org.id, roleId: ownerId } });
    await expect(assertNotLastOwner(org.id, a.id)).resolves.toBeUndefined();
  });

  it("un AGENT n'est pas OWNER", async () => {
    const org = await makeOrg();
    const a = await makeUser();
    const b = await makeUser();
    await prisma.orgMembership.create({ data: { userId: a.id, orgId: org.id, roleId: await sysRoleId("OWNER") } });
    await prisma.orgMembership.create({ data: { userId: b.id, orgId: org.id, roleId: await sysRoleId("AGENT") } });
    await expect(assertNotLastOwner(org.id, a.id)).rejects.toMatchObject({ code: "LAST_OWNER" });
  });

  it("un OWNER par colonne d'enum seule compte encore", async () => {
    const org = await makeOrg();
    const a = await makeUser();
    const b = await makeUser();
    await prisma.orgMembership.create({ data: { userId: a.id, orgId: org.id, role: "OWNER" } });
    await prisma.orgMembership.create({ data: { userId: b.id, orgId: org.id, role: "OWNER" } });
    await expect(assertNotLastOwner(org.id, a.id)).resolves.toBeUndefined();
  });

  it("assertNotLastSuperAdmin compte un SUPER_ADMIN via roleId seul", async () => {
    const a = await makeUser({ isStaff: true, platformRoleId: await sysRoleId("SUPER_ADMIN") });
    const b = await makeUser({ isStaff: true, platformRoleId: await sysRoleId("SUPER_ADMIN") });
    await expect(assertNotLastSuperAdmin(a.id)).resolves.toBeUndefined();
    await prisma.user.update({ where: { id: b.id }, data: { platformRoleId: await sysRoleId("STAFF_ADMIN") } });
    await expect(assertNotLastSuperAdmin(a.id)).rejects.toMatchObject({ code: "LAST_SUPER_ADMIN" });
  });

  it("assertNotLastSuperAdmin compte un SUPER_ADMIN par colonne d'enum seule", async () => {
    const a = await makeStaff("SUPER_ADMIN");
    await makeStaff("SUPER_ADMIN");
    await expect(assertNotLastSuperAdmin(a.id)).resolves.toBeUndefined();
  });
});
