import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { systemRoleId } from "@/lib/permissions/db";
import { loadUserContext } from "@/lib/user-context";
import { accessibleEventIds, accessibleOrgIds, resolveHomeRedirect } from "@/lib/org-redirect";
import {
  makeCustomRole, makeEvent, makeEventMember, makeOrg, makeOrgMember, makeStaff, makeUser, seedFactories,
} from "@/test/factories";

seedFactories(2501);

const ctxOf = async (userId: string) => (await loadUserContext(userId))!;

describe("resolveHomeRedirect", () => {
  it("returns /login if no userContext", () => {
    expect(resolveHomeRedirect(null)).toBe("/login");
  });

  it("staff seul : /platform", async () => {
    const staff = await makeStaff("STAFF_SUPPORT");
    expect(resolveHomeRedirect(await ctxOf(staff.id))).toBe("/platform");
  });

  it("AGENT d'une seule organisation : /org/<id>", async () => {
    const org = await makeOrg();
    const agent = await makeOrgMember(org.id, "AGENT");
    expect(resolveHomeRedirect(await ctxOf(agent.id))).toBe(`/org/${org.id}`);
  });

  it("membre d'évènement seul : /event/<id>", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const op = await makeEventMember(event.id, "OPERATOR");
    expect(resolveHomeRedirect(await ctxOf(op.id))).toBe(`/event/${event.id}`);
  });

  it("membre d'organisation sans org.read (rôle personnalisé) et d'un évènement : l'évènement seulement", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const role = await makeCustomRole({ scope: "ORG", orgId: org.id, permissions: ["org.events.list"] });
    const user = await makeUser();
    await prisma.orgMembership.create({ data: { userId: user.id, orgId: org.id, roleId: role.id } });
    await prisma.eventMembership.create({
      data: { userId: user.id, eventId: event.id, roleId: await systemRoleId(prisma, "VIEWER"), role: "VIEWER" },
    });
    expect(resolveHomeRedirect(await ctxOf(user.id))).toBe(`/event/${event.id}`);
  });

  it("deux organisations : /select", async () => {
    const [a, b] = [await makeOrg(), await makeOrg()];
    const user = await makeOrgMember(a.id, "OWNER");
    await prisma.orgMembership.create({
      data: { userId: user.id, orgId: b.id, roleId: await systemRoleId(prisma, "OWNER"), role: "OWNER" },
    });
    expect(resolveHomeRedirect(await ctxOf(user.id))).toBe("/select");
  });

  it("AUDITOR + membre d'un évènement : /select", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const user = await makeOrgMember(org.id, "AUDITOR");
    await prisma.eventMembership.create({
      data: { userId: user.id, eventId: event.id, roleId: await systemRoleId(prisma, "PRINTER"), role: "PRINTER" },
    });
    expect(resolveHomeRedirect(await ctxOf(user.id))).toBe("/select");
  });

  it("staff également membre d'une organisation : /select", async () => {
    const org = await makeOrg();
    const staff = await makeStaff("STAFF_SUPPORT");
    await prisma.orgMembership.create({
      data: { userId: staff.id, orgId: org.id, roleId: await systemRoleId(prisma, "OWNER"), role: "OWNER" },
    });
    expect(resolveHomeRedirect(await ctxOf(staff.id))).toBe("/select");
  });

  it("aucun espace : /account", async () => {
    expect(resolveHomeRedirect(await ctxOf((await makeUser()).id))).toBe("/account");
  });
});

describe("accessibleOrgIds / accessibleEventIds", () => {
  it("écarte un rôle d'évènement personnalisé sans aucune permission", async () => {
    const org = await makeOrg();
    const event = await makeEvent(org.id);
    const role = await makeCustomRole({ scope: "EVENT", orgId: org.id, permissions: [] });
    const user = await makeUser();
    await prisma.eventMembership.create({ data: { userId: user.id, eventId: event.id, roleId: role.id } });
    const ctx = await ctxOf(user.id);
    expect(accessibleEventIds(ctx)).toEqual([]);
    expect(accessibleOrgIds(ctx)).toEqual([]);
  });
});
