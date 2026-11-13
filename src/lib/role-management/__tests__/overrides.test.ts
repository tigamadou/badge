import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { makeCustomRole, makeOrg, makeOrgMember, makeOverride, makeStaff, makeUser, seedFactories } from "@/test/factories";
import { RoleError, applyOverrides, loadOrgLevel, loadPlatformLevels } from "..";

beforeEach(() => seedFactories(11));

const ctxOf = async (userId: string) => (await loadUserContext(userId))!;

async function rejection(p: Promise<unknown>): Promise<RoleError> {
  try {
    await p;
  } catch (e) {
    return e as RoleError;
  }
  throw new Error("aucune erreur levée");
}

async function rows(userId: string, orgId: string | null) {
  return (await prisma.userPermissionOverride.findMany({ where: { userId, orgId } })).map((r) => `${r.permission}:${r.effect}`).sort();
}

describe("applyOverrides", () => {
  it("remplace l'ensemble du niveau plateforme : ajout, changement, retrait", async () => {
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    const org = await makeOrg();
    const target = await makeOrgMember(org.id, "MANAGER");
    const first = await applyOverrides(sa, target.id, null, [
      { permission: "registration.export", effect: "REVOKE" },
      { permission: "org.events.create", effect: "GRANT" },
    ]);
    expect(first.added).toHaveLength(2);
    expect(await rows(target.id, null)).toEqual(["org.events.create:GRANT", "registration.export:REVOKE"]);

    const second = await applyOverrides(sa, target.id, null, [
      { permission: "registration.export", effect: "GRANT" },
      { permission: "account.profile.update", effect: "REVOKE" },
    ]);
    expect(second).toEqual({
      added: [{ permission: "account.profile.update", effect: "REVOKE" }],
      removed: [{ permission: "org.events.create", effect: "GRANT" }],
      changed: [{ permission: "registration.export", from: "REVOKE", to: "GRANT" }],
    });
    expect(await rows(target.id, null)).toEqual(["account.profile.update:REVOKE", "registration.export:GRANT"]);
    const log = await prisma.activityLog.findMany({ where: { type: "USER_PERMISSIONS_CHANGED", targetId: target.id }, orderBy: { createdAt: "asc" } });
    expect(log).toHaveLength(2);
    expect(log[1]).toMatchObject({ userId: sa.user.id, orgId: null });
  });

  it("est idempotent : une seule ligne par clé, pas de journal pour un diff vide, doublons nettoyés", async () => {
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    const target = await makeUser();
    // MySQL tolère les doublons quand orgId est NULL : le remplacement les résorbe.
    await makeOverride({ userId: target.id, permission: "registration.self.create", effect: "REVOKE" });
    await makeOverride({ userId: target.id, permission: "registration.self.create", effect: "REVOKE" });
    const desired = [{ permission: "registration.self.create", effect: "REVOKE" as const }];
    const diff = await applyOverrides(sa, target.id, null, desired);
    expect(diff).toEqual({ added: [], removed: [], changed: [] });
    expect(await rows(target.id, null)).toEqual(["registration.self.create:REVOKE"]);
    await applyOverrides(sa, target.id, null, desired);
    expect(await prisma.activityLog.count({ where: { type: "USER_PERMISSIONS_CHANGED" } })).toBe(0);
    // dernière valeur gagnante pour une clé répétée
    await applyOverrides(sa, target.id, null, [
      { permission: "registration.self.create", effect: "GRANT" },
      { permission: "registration.self.create", effect: "REVOKE" },
    ]);
    expect(await rows(target.id, null)).toEqual(["registration.self.create:REVOKE"]);
    // un compte sans ligne et un tableau vide
    expect(await applyOverrides(sa, target.id, null, [])).toMatchObject({ removed: [{ permission: "registration.self.create" }] });
    expect(await rows(target.id, null)).toEqual([]);
  });

  it("refuse soi-même, utilisateur inconnu ou archivé, non-membre", async () => {
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    const org = await makeOrg();
    const outsider = await makeUser();
    const archived = await makeUser({ archived: true });
    expect((await rejection(applyOverrides(sa, sa.user.id, null, []))).code).toBe("SELF_MODIFICATION");
    expect((await rejection(applyOverrides(sa, "inconnu", null, []))).code).toBe("NOT_FOUND");
    expect((await rejection(applyOverrides(sa, archived.id, null, []))).code).toBe("NOT_FOUND");
    expect((await rejection(applyOverrides(sa, outsider.id, org.id, []))).code).toBe("NOT_FOUND");
  });

  it("valide les clés : inconnue, réservée, hors niveau", async () => {
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    const org = await makeOrg();
    const member = await makeOrgMember(org.id, "MANAGER");
    const run = (orgId: string | null, permission: string) => applyOverrides(sa, member.id, orgId, [{ permission, effect: "REVOKE" }]);
    expect((await rejection(run(null, "nope"))).code).toBe("INVALID_PERMISSION");
    expect((await rejection(run(null, "platform.roles.manage"))).code).toBe("RESERVED_PERMISSION");
    expect((await rejection(run(org.id, "org.roles.manage"))).code).toBe("RESERVED_PERMISSION");
    expect((await rejection(run(org.id, "settings.update"))).code).toBe("INVALID_PERMISSION");
    expect((await rejection(run(org.id, "account.profile.update"))).code).toBe("INVALID_PERMISSION");
    expect(await rows(member.id, org.id)).toEqual([]);
  });

  it("GRANT : exige de détenir la permission, sauf si inchangé ; REVOKE toujours permis", async () => {
    const org = await makeOrg();
    const ownerUser = await makeOrgMember(org.id, "OWNER");
    const owner = await ctxOf(ownerUser.id);
    const manager = await makeOrgMember(org.id, "MANAGER");
    const auditor = await makeOrgMember(org.id, "AUDITOR");

    await applyOverrides(owner, manager.id, org.id, [{ permission: "event.update", effect: "REVOKE" }]);
    await applyOverrides(owner, auditor.id, org.id, [{ permission: "event.update", effect: "GRANT" }]);
    expect((await rejection(applyOverrides(owner, auditor.id, org.id, [{ permission: "settings.update", effect: "GRANT" }]))).code).toBe("INVALID_PERMISSION");
    expect((await rejection(applyOverrides(owner, auditor.id, org.id, [{ permission: "org.roles.manage", effect: "GRANT" }]))).code).toBe("RESERVED_PERMISSION");

    // un OWNER « réduit » ne peut plus accorder ce qu'il a perdu, mais peut conserver un GRANT existant
    await makeOverride({ userId: ownerUser.id, orgId: org.id, permission: "org.events.create", effect: "REVOKE" });
    const reduced = await ctxOf(ownerUser.id);
    await makeOverride({ userId: auditor.id, orgId: org.id, permission: "org.events.create", effect: "GRANT" });
    expect((await rejection(applyOverrides(reduced, manager.id, org.id, [{ permission: "org.events.create", effect: "GRANT" }]))).code).toBe("PERMISSION_NOT_HELD");
    const kept = await applyOverrides(reduced, auditor.id, org.id, [
      { permission: "event.update", effect: "GRANT" },
      { permission: "org.events.create", effect: "GRANT" },
    ]);
    expect(kept).toEqual({ added: [], removed: [], changed: [] });
    // et peut retirer ce GRANT non détenu
    expect((await applyOverrides(reduced, auditor.id, org.id, [{ permission: "event.update", effect: "GRANT" }])).removed).toHaveLength(1);
  });

  it("l'ajustement d'organisation n'affecte pas les autres organisations ni le niveau plateforme", async () => {
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    const [a, b] = [await makeOrg(), await makeOrg()];
    const member = await makeOrgMember(a.id, "MANAGER");
    await prisma.orgMembership.create({ data: { userId: member.id, orgId: b.id, roleId: (await prisma.orgMembership.findFirstOrThrow({ where: { userId: member.id } })).roleId } });
    await applyOverrides(sa, member.id, a.id, [{ permission: "event.update", effect: "REVOKE" }]);
    expect(await rows(member.id, a.id)).toEqual(["event.update:REVOKE"]);
    expect(await rows(member.id, b.id)).toEqual([]);
    expect(await rows(member.id, null)).toEqual([]);
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "USER_PERMISSIONS_CHANGED" } });
    expect(log).toMatchObject({ orgId: a.id });
  });

  it("OWNER_PROTECTED : un OWNER ne règle pas un autre OWNER, le détenteur de users.permissions.manage le peut", async () => {
    const org = await makeOrg();
    const owner = await ctxOf((await makeOrgMember(org.id, "OWNER")).id);
    const other = await makeOrgMember(org.id, "OWNER");
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    expect((await rejection(applyOverrides(owner, other.id, org.id, []))).code).toBe("OWNER_PROTECTED");
    expect(await applyOverrides(sa, other.id, org.id, [{ permission: "event.update", effect: "REVOKE" }])).toMatchObject({ added: [{ permission: "event.update" }] });
  });

  it("un membre dont le rôle est archivé reste ajustable", async () => {
    const org = await makeOrg();
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    const role = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: ["org.read"] });
    const member = await makeOrgMember(org.id, "AUDITOR");
    await prisma.orgMembership.updateMany({ where: { userId: member.id }, data: { roleId: role.id } });
    await prisma.role.update({ where: { id: role.id }, data: { archived: true } });
    expect(await applyOverrides(sa, member.id, org.id, [{ permission: "event.update", effect: "GRANT" }])).toMatchObject({ added: [{ permission: "event.update" }] });
  });
});

describe("loadPlatformLevels et loadOrgLevel", () => {
  it("niveau plateforme puis une organisation, hérité / ajustements / effectif cohérents", async () => {
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    const [a, b] = [await makeOrg({ name: "Beta" }), await makeOrg({ name: "Alpha" })];
    const member = await makeOrgMember(a.id, "MANAGER");
    await prisma.orgMembership.create({ data: { userId: member.id, orgId: b.id, roleId: (await prisma.orgMembership.findFirstOrThrow({ where: { userId: member.id } })).roleId } });
    await applyOverrides(sa, member.id, null, [
      { permission: "registration.export", effect: "REVOKE" },
      { permission: "registration.self.create", effect: "REVOKE" },
    ]);
    await applyOverrides(sa, member.id, a.id, [
      { permission: "registration.export", effect: "GRANT" },
      { permission: "billing.subscription.pay", effect: "REVOKE" },
    ]);
    const levels = (await loadPlatformLevels(member.id))!;
    expect(levels.map((l) => (l.target.kind === "org" ? l.target.orgName : "platform"))).toEqual(["platform", "Alpha", "Beta"]);
    const [platform, alpha, beta] = levels;
    expect(platform.role).toBeNull();
    expect(platform.inherited).toContain("registration.self.create");
    expect(platform.effective).not.toContain("registration.self.create");
    expect(platform.overrides).toEqual([
      { permission: "registration.export", effect: "REVOKE" },
      { permission: "registration.self.create", effect: "REVOKE" },
    ]);
    // Alpha (b) : l'ajustement plateforme s'applique, rien de propre à l'organisation
    expect(alpha.role).toMatchObject({ name: "Gestionnaire", systemKey: "MANAGER" });
    expect(alpha.inherited).not.toContain("registration.export");
    expect(alpha.effective).not.toContain("registration.export");
    expect(alpha.inherited).not.toContain("registration.self.create");
    // Beta (a) : GRANT d'organisation par-dessus le REVOKE plateforme
    expect(beta.inherited).not.toContain("registration.export");
    expect(beta.effective).toContain("registration.export");
    expect(beta.effective).not.toContain("billing.subscription.pay");
    expect(beta.overrides).toHaveLength(2);
  });

  it("niveau plateforme d'un staff : rôle et permissions du rôle ; staff sans rôle valide", async () => {
    const staff = await makeStaff("STAFF_SUPPORT");
    const [platform] = (await loadPlatformLevels(staff.id))!;
    expect(platform.role).toMatchObject({ systemKey: "STAFF_SUPPORT" });
    expect(platform.inherited).toContain("users.read");
    const ghost = await makeUser({ isStaff: true });
    const [ghostLevel] = (await loadPlatformLevels(ghost.id))!;
    expect(ghostLevel.role).toBeNull();
    expect(ghostLevel.inherited).not.toContain("users.read");
  });

  it("loadOrgLevel : niveau de l'organisation, rôle archivé sans permissions, null si inconnu ou non membre", async () => {
    const org = await makeOrg({ name: "Acme" });
    const member = await makeOrgMember(org.id, "AUDITOR");
    const level = (await loadOrgLevel(member.id, org.id))!;
    expect(level.target).toEqual({ kind: "org", orgId: org.id, orgName: "Acme" });
    expect(level.effective).toContain("org.read");
    const role = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: ["org.read"] });
    await prisma.orgMembership.updateMany({ where: { userId: member.id }, data: { roleId: role.id } });
    await prisma.role.update({ where: { id: role.id }, data: { archived: true } });
    const orphan = (await loadOrgLevel(member.id, org.id))!;
    expect(orphan.role).toBeNull();
    expect(orphan.effective).toEqual([]);
    expect(await loadOrgLevel("inconnu", org.id)).toBeNull();
    expect(await loadOrgLevel((await makeUser()).id, org.id)).toBeNull();
    expect(await loadPlatformLevels("inconnu")).toBeNull();
  });
});
