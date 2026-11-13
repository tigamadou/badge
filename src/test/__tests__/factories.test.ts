import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  makeCategory,
  makeCustomRole,
  makeEvent,
  makeEventMember,
  makeInstalledTemplate,
  makeOrg,
  makeOrgMember,
  makeOverride,
  makePrintLayout,
  makePrintOrder,
  makeRegistration,
  makeStaff,
  makeUser,
  seedFactories,
} from "@/test/factories";

describe("fabriques de test", () => {
  it("créent une chaîne complète en base, avec des valeurs uniques", async () => {
    seedFactories(1);
    const staff = await makeStaff("STAFF_ADMIN");
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const cat1 = await makeCategory(event.id);
    const cat2 = await makeCategory(event.id);
    const reg = await makeRegistration(event.id, cat1.id, "PENDING");
    const template = await makeInstalledTemplate(staff.id, { pages: 2 });
    const layout = await makePrintLayout();
    const order = await makePrintOrder({ eventId: event.id, orgId: org.id, status: "PAID" });

    expect(staff).toMatchObject({ isStaff: true, staffRole: "STAFF_ADMIN" });
    expect([cat1.number, cat2.number]).toEqual([1, 2]);
    expect(reg).toMatchObject({ eventId: event.id, categoryId: cat1.id, status: "PENDING" });
    expect(template.pages).toBe(2);
    expect(layout.gapHorizontal).toBe(50);
    expect(order).toMatchObject({ status: "PAID", type: "ADVANCE" });
    expect(await prisma.user.count()).toBe(2);

    const [a, b] = [await makeUser(), await makeUser()];
    expect(a.email).not.toBe(b.email);
  });

  it("acceptent des surcharges", async () => {
    const user = await makeUser({ name: "Awa Diallo" });
    const org = await makeOrg({ name: "Acme" });
    expect(user.name).toBe("Awa Diallo");
    expect(org.name).toBe("Acme");
  });

  describe("rôles système", () => {
    it("makeStaff pose le rôle plateforme sans colonne d'enum pour STAFF_PRINTER", async () => {
      const u = await makeStaff("STAFF_PRINTER");
      const role = await prisma.role.findUniqueOrThrow({ where: { systemKey: "STAFF_PRINTER" } });
      expect(u).toMatchObject({ isStaff: true, platformRoleId: role.id, staffRole: null });
    });

    it("makeStaff écrit aussi la colonne d'enum pour un rôle hérité", async () => {
      const u = await makeStaff("STAFF_ADMIN");
      const role = await prisma.role.findUniqueOrThrow({ where: { systemKey: "STAFF_ADMIN" } });
      expect(u).toMatchObject({ platformRoleId: role.id, staffRole: "STAFF_ADMIN" });
    });

    it("makeOrgMember : AGENT sans enum, OWNER avec enum", async () => {
      const org = await makeOrg();
      const agent = await makeOrgMember(org.id, "AGENT");
      const owner = await makeOrgMember(org.id, "OWNER");
      const agentRole = await prisma.role.findUniqueOrThrow({ where: { systemKey: "AGENT" } });
      const ownerRole = await prisma.role.findUniqueOrThrow({ where: { systemKey: "OWNER" } });
      expect(await prisma.orgMembership.findFirstOrThrow({ where: { userId: agent.id } })).toMatchObject({
        orgId: org.id,
        roleId: agentRole.id,
        role: null,
      });
      expect(await prisma.orgMembership.findFirstOrThrow({ where: { userId: owner.id } })).toMatchObject({
        roleId: ownerRole.id,
        role: "OWNER",
      });
    });

    it("makeEventMember pose roleId et la colonne d'enum", async () => {
      const org = await makeOrg();
      const event = await makeEvent(org.id);
      const u = await makeEventMember(event.id, "PRINTER");
      const role = await prisma.role.findUniqueOrThrow({ where: { systemKey: "PRINTER" } });
      expect(await prisma.eventMembership.findFirstOrThrow({ where: { userId: u.id } })).toMatchObject({
        eventId: event.id,
        roleId: role.id,
        role: "PRINTER",
      });
    });

    it("makeCustomRole crée le rôle et ses permissions", async () => {
      const org = await makeOrg();
      const role = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: ["org.read"] });
      expect(role).toMatchObject({ scope: "ORG", orgId: org.id, systemKey: null });
      expect(await prisma.rolePermission.findMany({ where: { roleId: role.id } })).toEqual([
        { roleId: role.id, permission: "org.read" },
      ]);
    });

    it("makeOverride crée un ajustement", async () => {
      const u = await makeUser();
      const o = await makeOverride({ userId: u.id, permission: "platform.access", effect: "GRANT" });
      expect(o).toMatchObject({ userId: u.id, orgId: null, permission: "platform.access", effect: "GRANT" });
    });

    it("le reset supprime rôles et ajustements (premier test)", async () => {
      await makeStaff("SUPER_ADMIN");
      const u = await makeUser();
      await makeOverride({ userId: u.id, permission: "platform.access", effect: "GRANT" });
      expect(await prisma.role.count()).toBeGreaterThan(0);
    });

    it("le reset supprime rôles et ajustements (second test sans collision)", async () => {
      expect(await prisma.role.count()).toBe(0);
      expect(await prisma.userPermissionOverride.count()).toBe(0);
      await expect(makeStaff("SUPER_ADMIN")).resolves.toMatchObject({ staffRole: "SUPER_ADMIN" });
    });
  });
});
