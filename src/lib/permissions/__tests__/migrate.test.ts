import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeEvent, makeOrg, makeUser, seedFactories } from "@/test/factories";
import { ensureSystemRoles } from "../db";
import { migrateRoles } from "../migrate";

beforeEach(() => seedFactories(8));

async function seedLegacy() {
  const ids = await ensureSystemRoles(prisma);
  const staff = await makeUser({ isStaff: true, staffRole: "STAFF_ADMIN" });
  const inconsistent = await makeUser({ isStaff: false, staffRole: "STAFF_ADMIN" });
  const plain = await makeUser();
  const owner = await makeUser();
  const viewer = await makeUser();
  const org = await makeOrg();
  const event = await makeEvent(org.id);
  const orgMembership = await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });
  const eventMembership = await prisma.eventMembership.create({
    data: { userId: viewer.id, eventId: event.id, role: "VIEWER" },
  });
  return { ids, staff, inconsistent, plain, orgMembership, eventMembership };
}

describe("migrateRoles", () => {
  it("renseigne roleId depuis les colonnes d'enum, sans les toucher", async () => {
    const { ids, staff, inconsistent, plain, orgMembership, eventMembership } = await seedLegacy();

    const report = await migrateRoles(prisma);
    expect(report).toMatchObject({ users: 1, orgMemberships: 1, eventMemberships: 1, inconsistentStaff: 1 });

    const u = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect(u.platformRoleId).toBe(ids.STAFF_ADMIN);
    expect(u.isStaff).toBe(true);
    expect(u.staffRole).toBe("STAFF_ADMIN");
    // Un compte non staff portant un staffRole n'est ni migré ni promu : il est seulement compté.
    const i = await prisma.user.findUniqueOrThrow({ where: { id: inconsistent.id } });
    expect(i.platformRoleId).toBeNull();
    expect(i.isStaff).toBe(false);
    expect(i.staffRole).toBe("STAFF_ADMIN");
    const p = await prisma.user.findUniqueOrThrow({ where: { id: plain.id } });
    expect(p.platformRoleId).toBeNull();
    expect(p.isStaff).toBe(false);

    const om = await prisma.orgMembership.findUniqueOrThrow({ where: { id: orgMembership.id } });
    expect(om.roleId).toBe(ids.OWNER);
    expect(om.role).toBe("OWNER");
    const em = await prisma.eventMembership.findUniqueOrThrow({ where: { id: eventMembership.id } });
    expect(em.roleId).toBe(ids.VIEWER);
    expect(em.role).toBe("VIEWER");
  });

  it("est idempotent : le second appel ne change rien et compte alreadyDone", async () => {
    await seedLegacy();
    await migrateRoles(prisma);
    const report = await migrateRoles(prisma);
    expect(report).toMatchObject({ users: 0, orgMemberships: 0, eventMemberships: 0, inconsistentStaff: 1 });
    expect(report.alreadyDone).toBeGreaterThan(0);
  });

  it("dryRun n'écrit rien mais renvoie les mêmes compteurs", async () => {
    const { staff, orgMembership, eventMembership } = await seedLegacy();
    const report = await migrateRoles(prisma, { dryRun: true });
    expect(report).toMatchObject({ users: 1, orgMemberships: 1, eventMemberships: 1, inconsistentStaff: 1 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).platformRoleId).toBeNull();
    expect((await prisma.orgMembership.findUniqueOrThrow({ where: { id: orgMembership.id } })).roleId).toBeNull();
    expect((await prisma.eventMembership.findUniqueOrThrow({ where: { id: eventMembership.id } })).roleId).toBeNull();
  });

  it("ne modifie pas une ligne dont roleId est déjà posé", async () => {
    const { ids, orgMembership } = await seedLegacy();
    await prisma.orgMembership.update({ where: { id: orgMembership.id }, data: { roleId: ids.AGENT } });
    const report = await migrateRoles(prisma);
    expect(report.orgMemberships).toBe(0);
    expect((await prisma.orgMembership.findUniqueOrThrow({ where: { id: orgMembership.id } })).roleId).toBe(ids.AGENT);
  });
});
