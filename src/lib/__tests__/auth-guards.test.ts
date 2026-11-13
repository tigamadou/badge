import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  assertNotLastOwner,
  assertNotLastSuperAdmin,
  requirePermission,
  loadPermissions,
  loadMemberPermissions,
  loadEventTarget,
} from "@/lib/auth-guards";
import type { SystemRoleKey } from "@/lib/permissions";
import { SYSTEM_ROLES } from "@/lib/permissions";
import { makeEvent, makeOrg, makeOrgMember, makeStaff, makeUser } from "@/test/factories";

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

describe("assertNotLastSuperAdmin - ligne incoherente", () => {
  beforeEach(resetAll);

  it("une ligne isStaff=false portant SUPER_ADMIN ne protege pas le dernier SUPER_ADMIN effectif", async () => {
    const u = await prisma.user.create({
      data: { email: "sa-real@x", password: "x", name: "SA", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await prisma.user.create({
      data: { email: "sa-ghost@x", password: "x", name: "Ghost", isStaff: false, staffRole: "SUPER_ADMIN" },
    });
    await expect(assertNotLastSuperAdmin(u.id)).rejects.toMatchObject({ code: "LAST_SUPER_ADMIN" });
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

describe("loadMemberPermissions", () => {
  beforeEach(resetAll);

  it("écarte le rôle plateforme d'un staff membre ; ensemble vide pour un utilisateur inconnu", async () => {
    const org = await makeOrg();
    const sa = await makeOrgMember(org.id, "AGENT", { isStaff: true, staffRole: "SUPER_ADMIN" });
    const target = { kind: "org", orgId: org.id } as const;
    expect((await loadPermissions(sa.id, target)).has("print.quote.accept")).toBe(true);
    const member = await loadMemberPermissions(sa.id, target);
    expect(member.has("print.quote.accept")).toBe(false);
    expect(member.has("org.read")).toBe(true);
    expect((await loadMemberPermissions("missing", target)).size).toBe(0);
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
