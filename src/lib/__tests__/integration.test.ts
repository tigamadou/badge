import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import {
  requireStaff,
  requireOrgRole,
  requireEventPermission,
  assertNotLastOwner,
  assertNotLastSuperAdmin,
  AuthError,
} from "@/lib/auth-guards";
import { loadUserContext } from "@/lib/user-context";

describe("v2 RBAC integration", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.eventSettings.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  it("STAFF_ADMIN can act across orgs without OrgMembership", async () => {
    const staff = await prisma.user.create({
      data: {
        email: "s@x",
        password: await hash("pw", 12),
        name: "S",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
      },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-o" } });

    await expect(requireStaff(staff.id, "STAFF_OBSERVER")).resolves.toBeUndefined();
    await expect(requireOrgRole(staff.id, org.id, "OWNER")).resolves.toBeUndefined();
  });

  it("SUPER_ADMIN passes requireStaff(SUPER_ADMIN) and toutes les operations sensibles", async () => {
    const sa = await prisma.user.create({
      data: {
        email: "sa@x",
        password: await hash("pw", 12),
        name: "SA",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
      },
    });
    await prisma.user.create({
      data: { email: "sa2@x", password: "x", name: "SA2", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-sa" } });

    await expect(requireStaff(sa.id, "SUPER_ADMIN")).resolves.toBeUndefined();
    await expect(requireStaff(sa.id, "STAFF_ADMIN")).resolves.toBeUndefined();
    await expect(requireOrgRole(sa.id, org.id, "OWNER")).resolves.toBeUndefined();
    await expect(assertNotLastSuperAdmin(sa.id)).resolves.toBeUndefined();
  });

  it("STAFF_ADMIN ne satisfait pas requireStaff(SUPER_ADMIN)", async () => {
    const a = await prisma.user.create({
      data: { email: "a@x", password: "x", name: "A", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await expect(requireStaff(a.id, "SUPER_ADMIN")).rejects.toBeInstanceOf(AuthError);
  });

  it("OWNER scoped to its org only", async () => {
    const owner = await prisma.user.create({
      data: { email: "o@x", password: await hash("pw", 12), name: "O" },
    });
    const orgA = await prisma.organization.create({ data: { name: "A", slug: "int-a" } });
    const orgB = await prisma.organization.create({ data: { name: "B", slug: "int-b" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: orgA.id, role: "OWNER" } });

    await expect(requireOrgRole(owner.id, orgA.id, "OWNER")).resolves.toBeUndefined();
    await expect(requireOrgRole(owner.id, orgB.id, "OWNER")).rejects.toMatchObject({
      code: "ORG_FORBIDDEN",
    });
  });

  it("MANAGER can act on events (heritage ADMIN) mais pas sur les infos org", async () => {
    const mgr = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-mgr" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-mgr-e", location: "", date: new Date() },
    });
    await prisma.orgMembership.create({ data: { userId: mgr.id, orgId: org.id, role: "MANAGER" } });

    await expect(requireEventPermission(mgr.id, event.id, "event.update")).resolves.toBeUndefined();
    await expect(requireEventPermission(mgr.id, event.id, "registration.delete")).resolves.toBeUndefined();
    await expect(requireOrgRole(mgr.id, org.id, "OWNER")).rejects.toMatchObject({ code: "ORG_FORBIDDEN" });
    await expect(requireOrgRole(mgr.id, org.id, "MANAGER")).resolves.toBeUndefined();
  });

  it("AUDITOR sees aggregated event data but no detail nor mutation", async () => {
    const aud = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-aud" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-aud-e", location: "", date: new Date() },
    });
    await prisma.orgMembership.create({ data: { userId: aud.id, orgId: org.id, role: "AUDITOR" } });

    await expect(requireOrgRole(aud.id, org.id, "AUDITOR")).resolves.toBeUndefined();
    await expect(requireOrgRole(aud.id, org.id, "MANAGER")).rejects.toMatchObject({ code: "ORG_FORBIDDEN" });
    await expect(requireEventPermission(aud.id, event.id, "event.read.aggregated")).resolves.toBeUndefined();
    await expect(requireEventPermission(aud.id, event.id, "event.read.detailed")).rejects.toMatchObject({ code: "EVENT_FORBIDDEN" });
    await expect(requireEventPermission(aud.id, event.id, "registration.approve")).rejects.toMatchObject({ code: "EVENT_FORBIDDEN" });
  });

  it("PRINTER can print badges but cannot approve registrations", async () => {
    const printer = await prisma.user.create({ data: { email: "p@x", password: "x", name: "P" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-pr" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-pr-e", location: "", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: printer.id, eventId: event.id, role: "PRINTER" } });

    await expect(requireEventPermission(printer.id, event.id, "badge.print")).resolves.toBeUndefined();
    await expect(requireEventPermission(printer.id, event.id, "registration.approve")).rejects.toMatchObject({ code: "EVENT_FORBIDDEN" });
    await expect(requireEventPermission(printer.id, event.id, "scan.check-in")).rejects.toMatchObject({ code: "EVENT_FORBIDDEN" });
  });

  it("VIEWER sees aggregated only, no detail, no badge print", async () => {
    const vw = await prisma.user.create({ data: { email: "v@x", password: "x", name: "V" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-vw" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-vw-e", location: "", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: vw.id, eventId: event.id, role: "VIEWER" } });

    await expect(requireEventPermission(vw.id, event.id, "event.read.aggregated")).resolves.toBeUndefined();
    await expect(requireEventPermission(vw.id, event.id, "event.read.detailed")).rejects.toMatchObject({ code: "EVENT_FORBIDDEN" });
    await expect(requireEventPermission(vw.id, event.id, "badge.print")).rejects.toMatchObject({ code: "EVENT_FORBIDDEN" });
  });

  it("assertNotLastOwner blocks removing the last active OWNER", async () => {
    const owner = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-lo" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER" } });

    await expect(assertNotLastOwner(org.id, owner.id)).rejects.toMatchObject({ code: "LAST_OWNER" });
  });

  it("assertNotLastSuperAdmin blocks removing the SUPER_ADMIN from the only user", async () => {
    const sa = await prisma.user.create({
      data: { email: "sa@x", password: "x", name: "SA", isStaff: true, staffRole: "SUPER_ADMIN" },
    });
    await expect(assertNotLastSuperAdmin(sa.id)).rejects.toMatchObject({ code: "LAST_SUPER_ADMIN" });
  });

  it("loadUserContext returns full memberships", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x", password: "pw", name: "U" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-c" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-e", location: "", date: new Date() },
    });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "OPERATOR" },
    });

    const ctx = await loadUserContext(u.id);
    expect(ctx?.orgMemberships).toHaveLength(1);
    expect(ctx?.eventMemberships).toHaveLength(1);
  });
});
