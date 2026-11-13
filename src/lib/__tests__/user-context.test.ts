import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getUserContext, loadUserContext } from "@/lib/user-context";
import { systemRolePermissions } from "@/lib/permissions";
import type { RoleScope } from "@prisma/client";
import { makeEvent, makeOrg, makeUser, seedFactories } from "@/test/factories";

// Rôles écrits à la main tant que makeCustomRole n'existe pas (Task 9).
function makeRole(input: {
  scope: RoleScope;
  systemKey?: string | null;
  name?: string;
  permissions?: string[];
  archived?: boolean;
  orgId?: string | null;
}) {
  return prisma.role.create({
    data: {
      scope: input.scope,
      systemKey: input.systemKey ?? null,
      name: input.name ?? "Rôle",
      archived: input.archived ?? false,
      orgId: input.orgId ?? null,
      permissions: { create: (input.permissions ?? []).map((permission) => ({ permission })) },
    },
  });
}

describe("loadUserContext", () => {
  beforeEach(async () => {
    seedFactories(4);
    await prisma.userPermissionOverride.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.role.deleteMany();
  });

  it("résout un rôle plateforme système via roleId", async () => {
    const role = await makeRole({ scope: "PLATFORM", systemKey: "SUPER_ADMIN", name: "Super admin" });
    const u = await makeUser({ isStaff: true, platformRoleId: role.id });
    const ctx = await loadUserContext(u.id);
    expect(ctx?.platformRole?.id).toBe(role.id);
    expect(ctx?.platformRole?.systemKey).toBe("SUPER_ADMIN");
    expect(ctx?.platformRole?.permissions).toEqual(systemRolePermissions("SUPER_ADMIN"));
    expect(ctx?.staffRole).toBe("SUPER_ADMIN");
    expect(ctx?.orgMemberships).toEqual([]);
    expect(ctx?.eventMemberships).toEqual([]);
    expect(ctx?.overrides).toEqual([]);
  });

  it("replie staffRole sur le rôle système quand roleId est nul", async () => {
    const u = await makeUser({ isStaff: true, staffRole: "STAFF_ADMIN" });
    const ctx = await loadUserContext(u.id);
    expect(ctx?.platformRole?.id).toBeNull();
    expect(ctx?.platformRole?.systemKey).toBe("STAFF_ADMIN");
    expect(ctx?.platformRole?.permissions).toEqual(systemRolePermissions("STAFF_ADMIN"));
    expect(ctx?.staffRole).toBe("STAFF_ADMIN");
  });

  it("roleId l'emporte sur la colonne staffRole", async () => {
    const role = await makeRole({ scope: "PLATFORM", systemKey: "STAFF_PRINTER" });
    const u = await makeUser({ isStaff: true, staffRole: "STAFF_ADMIN", platformRoleId: role.id });
    const ctx = await loadUserContext(u.id);
    expect(ctx?.platformRole?.systemKey).toBe("STAFF_PRINTER");
    expect(ctx?.platformRole?.permissions).toEqual(systemRolePermissions("STAFF_PRINTER"));
    expect(ctx?.staffRole).toBeNull();
  });

  it("utilisateur client sans rôle : aucun rôle plateforme", async () => {
    const u = await makeUser();
    const ctx = await loadUserContext(u.id);
    expect(ctx?.isStaff).toBe(false);
    expect(ctx?.platformRole).toBeNull();
    expect(ctx?.staffRole).toBeNull();
  });

  it("replie OrgMembership.role et EventMembership.role sur les rôles système", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const u = await makeUser();
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    const ctx = await loadUserContext(u.id);
    expect(ctx?.orgMemberships).toHaveLength(1);
    const om = ctx!.orgMemberships[0];
    expect(om).toMatchObject({ orgId: org.id, roleId: null, role: "OWNER" });
    expect(om.roleRef?.id).toBeNull();
    expect(om.roleRef?.systemKey).toBe("OWNER");
    expect(om.roleRef?.permissions).toEqual(systemRolePermissions("OWNER"));
    const em = ctx!.eventMemberships[0];
    expect(em).toMatchObject({ eventId: event.id, roleId: null, role: "OPERATOR" });
    expect(em.roleRef?.systemKey).toBe("OPERATOR");
  });

  it("roleId d'appartenance l'emporte sur la colonne ; AGENT n'a pas de role hérité", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const agent = await makeRole({ scope: "ORG", systemKey: "AGENT" });
    const printer = await makeRole({ scope: "EVENT", systemKey: "PRINTER" });
    const u = await makeUser();
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER", roleId: agent.id } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN", roleId: printer.id } });
    const ctx = await loadUserContext(u.id);
    expect(ctx!.orgMemberships[0].roleRef?.systemKey).toBe("AGENT");
    expect(ctx!.orgMemberships[0].role).toBeNull();
    expect(ctx!.eventMemberships[0].roleRef?.systemKey).toBe("PRINTER");
    expect(ctx!.eventMemberships[0].role).toBe("PRINTER");
  });

  it("rôle personnalisé : permissions filtrées, rôles hérités nuls", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const custom = await makeRole({
      scope: "ORG",
      orgId: org.id,
      name: "Comptable",
      permissions: ["org.read", "inconnue.cle"],
    });
    const customEvent = await makeRole({ scope: "EVENT", orgId: org.id, permissions: ["event.read.aggregated"] });
    const customPlatform = await makeRole({ scope: "PLATFORM", permissions: ["platform.access", "zzz"] });
    const u = await makeUser({ isStaff: true, platformRoleId: customPlatform.id });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, roleId: custom.id } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, roleId: customEvent.id } });
    const ctx = await loadUserContext(u.id);
    const om = ctx!.orgMemberships[0];
    expect(om.role).toBeNull();
    expect(om.roleRef).toMatchObject({ id: custom.id, systemKey: null, scope: "ORG", name: "Comptable" });
    expect([...om.roleRef!.permissions]).toEqual(["org.read"]);
    expect(ctx!.eventMemberships[0].role).toBeNull();
    expect(ctx!.platformRole?.systemKey).toBeNull();
    expect([...ctx!.platformRole!.permissions]).toEqual(["platform.access"]);
    expect(ctx!.staffRole).toBeNull();
  });

  it("rôle archivé : traité comme aucun rôle", async () => {
    const org = await makeOrg();
    const archived = await makeRole({ scope: "ORG", orgId: org.id, permissions: ["org.read"], archived: true });
    const archivedPlatform = await makeRole({ scope: "PLATFORM", systemKey: "STAFF_ADMIN", archived: true });
    const u = await makeUser({ isStaff: true, staffRole: "STAFF_ADMIN", platformRoleId: archivedPlatform.id });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER", roleId: archived.id } });
    const ctx = await loadUserContext(u.id);
    expect(ctx?.platformRole).toBeNull();
    expect(ctx?.staffRole).toBeNull();
    expect(ctx!.orgMemberships).toEqual([
      { orgId: org.id, roleId: archived.id, roleRef: null, role: null },
    ]);
  });

  it("ignore une appartenance sans roleId ni colonne d'enum", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const u = await makeUser();
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: null } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: null } });
    const ctx = await loadUserContext(u.id);
    expect(ctx?.orgMemberships).toEqual([]);
    expect(ctx?.eventMemberships).toEqual([]);
  });

  it("charge les ajustements et ignore les clés inconnues", async () => {
    const org = await makeOrg();
    const u = await makeUser();
    await prisma.userPermissionOverride.createMany({
      data: [
        { userId: u.id, orgId: null, permission: "platform.access", effect: "GRANT" },
        { userId: u.id, orgId: org.id, permission: "org.read", effect: "REVOKE" },
        { userId: u.id, orgId: org.id, permission: "cle.inconnue", effect: "GRANT" },
      ],
    });
    const ctx = await loadUserContext(u.id);
    expect(ctx!.overrides).toHaveLength(2);
    expect(ctx!.overrides).toEqual(
      expect.arrayContaining([
        { orgId: null, permission: "platform.access", effect: "GRANT" },
        { orgId: org.id, permission: "org.read", effect: "REVOKE" },
      ]),
    );
  });

  it("renvoie null pour un utilisateur absent ou archivé", async () => {
    expect(await loadUserContext("missing")).toBeNull();
    const u = await makeUser({ archived: true, archivedAt: new Date() });
    expect(await loadUserContext(u.id)).toBeNull();
  });

  it("getUserContext renvoie la même valeur que loadUserContext", async () => {
    const u = await makeUser({ isStaff: true, staffRole: "STAFF_SUPPORT" });
    expect(await getUserContext(u.id)).toEqual(await loadUserContext(u.id));
  });
});
