import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { SYSTEM_ROLES } from "@/lib/permissions";
import { loadUserContext } from "@/lib/user-context";
import { makeCustomRole, makeEvent, makeEventMember, makeOrg, makeOrgMember, makeOverride, makeStaff, seedFactories } from "@/test/factories";
import {
  RoleError,
  archiveRole,
  assertCanAssignRole,
  createRole,
  getRole,
  listRoles,
  resolveAssignableRole,
  restoreRole,
  roleErrorResponse,
  updateRole,
  validateRolePermissions,
} from "..";

beforeEach(() => seedFactories(7));

async function ctxOf(userId: string) {
  return (await loadUserContext(userId))!;
}

async function rejection(p: Promise<unknown> | (() => unknown)): Promise<RoleError> {
  try {
    await (typeof p === "function" ? p() : p);
  } catch (e) {
    return e as RoleError;
  }
  throw new Error("aucune erreur levée");
}

describe("RoleError", () => {
  it("roleErrorResponse traduit une RoleError et ignore le reste", async () => {
    const res = roleErrorResponse(new RoleError("ROLE_IN_USE"))!;
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "ROLE_IN_USE" });
    const withDetail = roleErrorResponse(new RoleError("INVALID_PERMISSION", "x.y"))!;
    expect(withDetail.status).toBe(400);
    expect(await withDetail.json()).toEqual({ error: "INVALID_PERMISSION", detail: "x.y" });
    expect(roleErrorResponse(new Error("boom"))).toBeNull();
    expect(new RoleError("SYSTEM_ROLE").message).toBe("SYSTEM_ROLE");
  });
});

describe("validateRolePermissions", () => {
  it("clé inconnue, réservée ou hors niveau", async () => {
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    const platform = { scope: "PLATFORM" } as const;
    expect((await rejection(() => validateRolePermissions(sa, platform, ["nope"]))).code).toBe("INVALID_PERMISSION");
    expect((await rejection(() => validateRolePermissions(sa, platform, ["platform.roles.manage"]))).code).toBe("RESERVED_PERMISSION");
    expect((await rejection(() => validateRolePermissions(sa, { scope: "EVENT", orgId: "o" }, ["org.members.manage"]))).code).toBe("INVALID_PERMISSION");
    expect((await rejection(() => validateRolePermissions(sa, { scope: "ORG", orgId: "o" }, ["settings.update"]))).code).toBe("INVALID_PERMISSION");
    expect((await rejection(() => validateRolePermissions(sa, { scope: "ORG", orgId: "o" }, ["org.roles.manage"]))).code).toBe("RESERVED_PERMISSION");
  });

  it("refuse une permission que l'acteur ne détient pas, accepte celles de keep", async () => {
    const org = await makeOrg();
    const owner = await ctxOf((await makeOrgMember(org.id, "OWNER")).id);
    const platform = { scope: "PLATFORM" } as const;
    const err = await rejection(() => validateRolePermissions(owner, platform, ["settings.update"]));
    expect(err.code).toBe("PERMISSION_NOT_HELD");
    expect(validateRolePermissions(owner, platform, ["settings.update"], { keep: new Set(["settings.update"]) })).toEqual(["settings.update"]);
    expect(validateRolePermissions(owner, { scope: "ORG", orgId: org.id }, ["event.update", "org.events.create", "event.update"])).toEqual([
      "org.events.create",
      "event.update",
    ]);
  });

  it("un SUPER_ADMIN détient les permissions ORG et EVENT d'un rôle plateforme", async () => {
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    expect(validateRolePermissions(sa, { scope: "PLATFORM" }, ["org.events.create", "event.update", "users.read"])).toEqual([
      "users.read",
      "org.events.create",
      "event.update",
    ]);
  });
});

describe("createRole", () => {
  it("crée un rôle plateforme, écrit les permissions et journalise", async () => {
    const staff = await makeStaff("SUPER_ADMIN");
    const role = await createRole(await ctxOf(staff.id), { scope: "PLATFORM" }, { name: "  Lecteur élargi ", description: "d", permissions: ["users.read", "plans.read"] });
    expect(role).toMatchObject({ scope: "PLATFORM", systemKey: null, name: "Lecteur élargi", description: "d", orgId: null, archived: false, assignedCount: 0, permissions: ["plans.read", "users.read"] });
    const rows = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
    expect(rows.map((r) => r.permission).sort()).toEqual(["plans.read", "users.read"]);
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "ROLE_CREATED", targetId: role.id } });
    expect(log).toMatchObject({ userId: staff.id, orgId: null });
    expect(log.details).toMatchObject({ name: "Lecteur élargi", permissions: ["plans.read", "users.read"] });
  });

  it("nom pris : refusé parmi les non archivés, réutilisable après archivage, indépendant entre organisations", async () => {
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    const [a, b] = [await makeOrg(), await makeOrg()];
    const level = { scope: "ORG", orgId: a.id } as const;
    const first = await createRole(sa, level, { name: "Comptable", permissions: ["org.read"] });
    expect(first.description).toBeNull();
    expect((await rejection(createRole(sa, level, { name: "comptable", permissions: [] }))).code).toBe("ROLE_NAME_TAKEN");
    await createRole(sa, { scope: "ORG", orgId: b.id }, { name: "Comptable", permissions: [] });
    await createRole(sa, { scope: "EVENT", orgId: a.id }, { name: "Comptable", permissions: [] });
    await archiveRole(sa, { kind: "org", orgId: a.id }, first.id);
    await createRole(sa, level, { name: "Comptable", permissions: [] });
  });

  it("refuse le nom d'un rôle système du même niveau", async () => {
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    expect((await rejection(createRole(sa, { scope: "PLATFORM" }, { name: "Support", permissions: [] }))).code).toBe("ROLE_NAME_TAKEN");
    expect((await rejection(createRole(sa, { scope: "ORG", orgId: "x" }, { name: "Propriétaire", permissions: [] }))).code).toBe("ROLE_NAME_TAKEN");
  });

  it("un OWNER ne peut pas cocher une permission qu'il a perdue par ajustement", async () => {
    const org = await makeOrg();
    const ownerUser = await makeOrgMember(org.id, "OWNER");
    await makeOverride({ userId: ownerUser.id, orgId: org.id, permission: "org.events.create", effect: "REVOKE" });
    const err = await rejection(createRole(await ctxOf(ownerUser.id), { scope: "ORG", orgId: org.id }, { name: "R", permissions: ["org.events.create"] }));
    expect(err.code).toBe("PERMISSION_NOT_HELD");
  });
});

describe("updateRole, archiveRole, restoreRole", () => {
  async function setup() {
    const org = await makeOrg();
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    const owner = { kind: "org", orgId: org.id } as const;
    const role = await createRole(sa, { scope: "ORG", orgId: org.id }, { name: "Base", permissions: ["org.read", "org.events.create"] });
    return { org, sa, owner, role };
  }

  it("modifie nom, description et permissions, journalise avant / après", async () => {
    const { sa, owner, role } = await setup();
    const updated = await updateRole(sa, owner, role.id, { name: "Autre", description: null, permissions: ["org.read", "event.update"] });
    expect(updated).toMatchObject({ name: "Autre", permissions: ["org.read", "event.update"], assignedCount: 0 });
    const log = await prisma.activityLog.findFirstOrThrow({ where: { type: "ROLE_UPDATED", targetId: role.id } });
    expect(log.details).toMatchObject({
      before: { name: "Base", permissions: ["org.read", "org.events.create"] },
      after: { name: "Autre", permissions: ["org.read", "event.update"] },
    });
  });

  it("un patch partiel ne touche pas aux permissions", async () => {
    const { sa, owner, role } = await setup();
    const updated = await updateRole(sa, owner, role.id, { description: "texte" });
    expect(updated.permissions).toEqual(["org.read", "org.events.create"]);
    expect(updated.description).toBe("texte");
  });

  it("nom déjà pris (hors soi-même) et conservation du propre nom", async () => {
    const { org, sa, owner, role } = await setup();
    await createRole(sa, { scope: "ORG", orgId: org.id }, { name: "Autre", permissions: [] });
    expect((await rejection(updateRole(sa, owner, role.id, { name: "Autre" }))).code).toBe("ROLE_NAME_TAKEN");
    expect((await updateRole(sa, owner, role.id, { name: "Base" })).name).toBe("Base");
  });

  it("un OWNER peut conserver une permission déjà présente qu'il n'a plus, pas en ajouter une", async () => {
    const { org, sa, owner, role } = await setup();
    const ownerUser = await makeOrgMember(org.id, "OWNER");
    await makeOverride({ userId: ownerUser.id, orgId: org.id, permission: "org.events.create", effect: "REVOKE" });
    const ctx = await ctxOf(ownerUser.id);
    const kept = await updateRole(ctx, owner, role.id, { permissions: ["org.read", "org.events.create"] });
    expect(kept.permissions).toEqual(["org.read", "org.events.create"]);
    const other = await createRole(sa, { scope: "ORG", orgId: org.id }, { name: "Vide", permissions: [] });
    expect((await rejection(updateRole(ctx, owner, other.id, { permissions: ["org.events.create"] }))).code).toBe("PERMISSION_NOT_HELD");
  });

  it("rôle système : SYSTEM_ROLE sur modification, archivage, restauration", async () => {
    const { sa, owner } = await setup();
    const system = (await listRoles({ scope: "ORG" })).find((r) => r.systemKey === "MANAGER")!;
    expect((await rejection(updateRole(sa, owner, system.id, { name: "X" }))).code).toBe("SYSTEM_ROLE");
    expect((await rejection(archiveRole(sa, owner, system.id))).code).toBe("SYSTEM_ROLE");
    expect((await rejection(restoreRole(sa, owner, system.id))).code).toBe("SYSTEM_ROLE");
  });

  it("anti-IDOR : un rôle d'une autre organisation, plateforme ou inconnu répond NOT_FOUND", async () => {
    const { sa, owner, role } = await setup();
    const other = await makeOrg();
    const foreign = await makeCustomRole({ scope: "ORG", orgId: other.id, permissions: ["org.read"] });
    const platformRole = await makeCustomRole({ scope: "PLATFORM", permissions: ["users.read"] });
    const systemPlatform = (await listRoles({ scope: "PLATFORM" })).find((r) => r.systemKey === "STAFF_ADMIN")!;
    for (const id of [foreign.id, platformRole.id, systemPlatform.id, "inconnu"]) {
      expect((await rejection(updateRole(sa, owner, id, { name: "X" }))).code).toBe("NOT_FOUND");
      expect((await rejection(getRole(id, owner))).code).toBe("NOT_FOUND");
    }
    // côté plateforme : un rôle d'organisation est hors périmètre
    expect((await rejection(updateRole(sa, { kind: "platform" }, role.id, { name: "X" }))).code).toBe("NOT_FOUND");
    expect((await updateRole(sa, { kind: "platform" }, platformRole.id, { name: "Plateforme 2" })).name).toBe("Plateforme 2");
  });

  it("archive puis restaure ; le rôle porté par un membre n'est pas archivable", async () => {
    const { org, sa, owner, role } = await setup();
    const archived = await archiveRole(sa, owner, role.id);
    expect(archived.archived).toBe(true);
    expect(await prisma.activityLog.count({ where: { type: "ROLE_ARCHIVED", targetId: role.id } })).toBe(1);
    const restored = await restoreRole(sa, owner, role.id);
    expect(restored.archived).toBe(false);
    expect(await prisma.activityLog.count({ where: { type: "ROLE_RESTORED", targetId: role.id } })).toBe(1);

    const member = await makeOrgMember(org.id, "AUDITOR");
    await prisma.orgMembership.updateMany({ where: { userId: member.id }, data: { roleId: role.id } });
    expect((await rejection(archiveRole(sa, owner, role.id))).code).toBe("ROLE_IN_USE");
    expect((await getRole(role.id, owner)).assignedCount).toBe(1);
    // un compte archivé ne compte plus
    await prisma.user.update({ where: { id: member.id }, data: { archived: true } });
    expect((await getRole(role.id, owner)).assignedCount).toBe(0);
    await archiveRole(sa, owner, role.id);
  });

  it("archive et restaure un rôle plateforme", async () => {
    const { sa } = await setup();
    const platform = { kind: "platform" } as const;
    const role = await createRole(sa, { scope: "PLATFORM" }, { name: "Plateforme", permissions: ["users.read"] });
    expect((await archiveRole(sa, platform, role.id)).archived).toBe(true);
    expect((await restoreRole(sa, platform, role.id)).archived).toBe(false);
    const logs = await prisma.activityLog.findMany({ where: { targetId: role.id, orgId: null } });
    expect(logs.map((l) => l.type).sort()).toEqual(["ROLE_ARCHIVED", "ROLE_CREATED", "ROLE_RESTORED"]);
  });

  it("restauration refusée si le nom est désormais pris", async () => {
    const { org, sa, owner, role } = await setup();
    await archiveRole(sa, owner, role.id);
    await createRole(sa, { scope: "ORG", orgId: org.id }, { name: "Base", permissions: [] });
    expect((await rejection(restoreRole(sa, owner, role.id))).code).toBe("ROLE_NAME_TAKEN");
  });
});

describe("listRoles et assignedCount", () => {
  it("liste les rôles système puis les personnalisés, compte les porteurs de chaque type", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    const custom = await createRole(sa, { scope: "ORG", orgId: org.id }, { name: "Zeta", permissions: [] });
    await createRole(sa, { scope: "ORG", orgId: org.id }, { name: "Alpha", permissions: [] });
    const archived = await createRole(sa, { scope: "ORG", orgId: org.id }, { name: "Vieux", permissions: [] });
    await archiveRole(sa, { kind: "org", orgId: org.id }, archived.id);
    await makeOrgMember(org.id, "OWNER");
    await makeOrgMember(org.id, "OWNER");
    await makeStaff("STAFF_ADMIN");
    await makeEventMember(event.id, "ADMIN");
    await makeCustomRole({ scope: "ORG", orgId: (await makeOrg()).id, permissions: [] });

    const orgRoles = await listRoles({ scope: "ORG", orgId: org.id });
    expect(orgRoles.map((r) => r.name)).toEqual(["Propriétaire", "Gestionnaire", "Auditeur", "Agent", "Alpha", "Zeta"]);
    expect(orgRoles.find((r) => r.systemKey === "OWNER")!.assignedCount).toBe(2);
    expect(orgRoles.find((r) => r.id === custom.id)!.assignedCount).toBe(0);
    expect(orgRoles[0].permissions).toEqual([...SYSTEM_ROLES.OWNER.permissions]);
    expect(await listRoles({ scope: "ORG", orgId: org.id }, { includeArchived: true })).toHaveLength(7);

    const platform = await listRoles({ scope: "PLATFORM" });
    expect(platform.find((r) => r.systemKey === "STAFF_ADMIN")!.assignedCount).toBe(1);
    const events = await listRoles({ scope: "EVENT" });
    expect(events.find((r) => r.systemKey === "ADMIN")!.assignedCount).toBe(1);
    expect(events.find((r) => r.systemKey === "VIEWER")!.assignedCount).toBe(0);
  });

  it("recrée les lignes de rôles système absentes", async () => {
    await prisma.role.deleteMany();
    const roles = await listRoles({ scope: "EVENT" });
    expect(roles.map((r) => r.systemKey)).toEqual(["ADMIN", "OPERATOR", "PRINTER", "VIEWER"]);
  });

  it("ignore les clés inconnues ou réservées d'un rôle personnalisé", async () => {
    const org = await makeOrg();
    const role = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: ["org.read"] });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: role.id, permission: "inconnue" },
        { roleId: role.id, permission: "org.roles.manage" },
      ],
    });
    const dto = (await listRoles({ scope: "ORG", orgId: org.id })).find((r) => r.id === role.id)!;
    expect(dto.permissions).toEqual(["org.read"]);
  });
});

describe("resolveAssignableRole et assertCanAssignRole", () => {
  it("résout un rôle système ou personnalisé du bon niveau", async () => {
    const org = await makeOrg();
    const custom = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: ["org.read"] });
    const system = (await listRoles({ scope: "ORG" })).find((r) => r.systemKey === "AGENT")!;
    const level = { scope: "ORG", orgId: org.id } as const;
    expect((await resolveAssignableRole(custom.id, level)).id).toBe(custom.id);
    expect((await resolveAssignableRole(system.id, level)).systemKey).toBe("AGENT");
    expect(await resolveAssignableRole((await listRoles({ scope: "PLATFORM" }))[0].id, { scope: "PLATFORM" })).toMatchObject({ scope: "PLATFORM" });
  });

  it("refuse inconnu, archivé, autre organisation (404) et niveau incompatible (400)", async () => {
    const [a, b] = [await makeOrg(), await makeOrg()];
    const foreign = await makeCustomRole({ scope: "ORG", orgId: b.id, permissions: [] });
    const archived = await makeCustomRole({ scope: "ORG", orgId: a.id, permissions: [] });
    await prisma.role.update({ where: { id: archived.id }, data: { archived: true } });
    const platformCustom = await makeCustomRole({ scope: "PLATFORM", permissions: [] });
    const level = { scope: "ORG", orgId: a.id } as const;
    expect((await rejection(resolveAssignableRole("nope", level))).code).toBe("NOT_FOUND");
    expect((await rejection(resolveAssignableRole(archived.id, level))).code).toBe("NOT_FOUND");
    expect((await rejection(resolveAssignableRole(foreign.id, level))).code).toBe("NOT_FOUND");
    expect((await rejection(resolveAssignableRole(platformCustom.id, level))).code).toBe("INVALID_ROLE");
    expect((await rejection(resolveAssignableRole(foreign.id, { scope: "PLATFORM" }))).code).toBe("INVALID_ROLE");
    expect((await rejection(resolveAssignableRole(foreign.id, { scope: "EVENT", orgId: b.id }))).code).toBe("INVALID_ROLE");
  });

  it("un MANAGER ne peut pas attribuer OWNER ; un OWNER attribue ses propres rôles et ceux des évènements", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const manager = await ctxOf((await makeOrgMember(org.id, "MANAGER")).id);
    const owner = await ctxOf((await makeOrgMember(org.id, "OWNER")).id);
    const roles = await listRoles({ scope: "ORG" });
    const ownerRole = roles.find((r) => r.systemKey === "OWNER")!;
    const target = { kind: "org", orgId: org.id } as const;
    expect((await rejection(() => assertCanAssignRole(manager, ownerRole, target))).code).toBe("PERMISSION_NOT_HELD");
    expect(() => assertCanAssignRole(owner, ownerRole, target)).not.toThrow();
    const viewer = (await listRoles({ scope: "EVENT" })).find((r) => r.systemKey === "VIEWER")!;
    expect(() => assertCanAssignRole(owner, viewer, { kind: "event", eventId: event.id, orgId: org.id })).not.toThrow();
    expect(() => assertCanAssignRole(owner, viewer, target)).not.toThrow();
  });

  it("un staff non membre attribue un rôle système d'organisation, pas un rôle personnalisé qu'il ne détient pas", async () => {
    const org = await makeOrg();
    const admin = await ctxOf((await makeStaff("STAFF_ADMIN")).id);
    const roles = await listRoles({ scope: "ORG" });
    const ownerRole = roles.find((r) => r.systemKey === "OWNER")!;
    const target = { kind: "org", orgId: org.id } as const;
    expect(() => assertCanAssignRole(admin, ownerRole, target)).not.toThrow();
    // le staff membre de l'organisation n'a pas l'exception
    const member = await makeStaff("STAFF_ADMIN");
    await prisma.orgMembership.create({ data: { userId: member.id, orgId: org.id, roleId: ownerRole.id } });
    const memberCtx = await ctxOf(member.id);
    expect(() => assertCanAssignRole(memberCtx, ownerRole, target)).not.toThrow();
    const custom = await createRole(await ctxOf((await makeStaff("SUPER_ADMIN")).id), { scope: "ORG", orgId: org.id }, { name: "Payeur", permissions: ["billing.subscription.pay"] });
    expect((await rejection(() => assertCanAssignRole(admin, custom, target))).code).toBe("PERMISSION_NOT_HELD");
  });

  it("un staff SUPER_ADMIN attribue un rôle plateforme ; un STAFF_ADMIN pas SUPER_ADMIN", async () => {
    const sa = await ctxOf((await makeStaff("SUPER_ADMIN")).id);
    const admin = await ctxOf((await makeStaff("STAFF_ADMIN")).id);
    const superAdmin = (await listRoles({ scope: "PLATFORM" })).find((r) => r.systemKey === "SUPER_ADMIN")!;
    expect(() => assertCanAssignRole(sa, superAdmin, { kind: "platform" })).not.toThrow();
    expect(() => assertCanAssignRole(admin, superAdmin, { kind: "platform" })).toThrow(RoleError);
  });
});
