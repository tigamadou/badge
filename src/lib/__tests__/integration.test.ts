import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import {
  requirePermission,
  assertNotLastOwner,
  assertNotLastSuperAdmin,
  AuthError,
} from "@/lib/auth-guards";
import { loadUserContext } from "@/lib/user-context";
import { eventTargetOf } from "@/lib/permissions";

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

    await expect(requirePermission(staff.id, "platform.access", { kind: "platform" })).resolves.toBeUndefined();
    await expect(requirePermission(staff.id, "org.update", { kind: "org", orgId: org.id })).resolves.toBeUndefined();
  });

  it("SUPER_ADMIN passes toutes les operations sensibles", async () => {
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

    await expect(requirePermission(sa.id, "platform.roles.manage", { kind: "platform" })).resolves.toBeUndefined();
    await expect(requirePermission(sa.id, "users.update", { kind: "platform" })).resolves.toBeUndefined();
    await expect(requirePermission(sa.id, "org.update", { kind: "org", orgId: org.id })).resolves.toBeUndefined();
    await expect(assertNotLastSuperAdmin(sa.id)).resolves.toBeUndefined();
  });

  it("STAFF_ADMIN ne gere pas les roles de la plateforme", async () => {
    const a = await prisma.user.create({
      data: { email: "a@x", password: "x", name: "A", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await expect(requirePermission(a.id, "platform.roles.manage", { kind: "platform" })).rejects.toBeInstanceOf(AuthError);
  });

  it("OWNER scoped to its org only", async () => {
    const owner = await prisma.user.create({
      data: { email: "o@x", password: await hash("pw", 12), name: "O" },
    });
    const orgA = await prisma.organization.create({ data: { name: "A", slug: "int-a" } });
    const orgB = await prisma.organization.create({ data: { name: "B", slug: "int-b" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: orgA.id, role: "OWNER" } });

    await expect(requirePermission(owner.id, "org.update", { kind: "org", orgId: orgA.id })).resolves.toBeUndefined();
    await expect(requirePermission(owner.id, "org.update", { kind: "org", orgId: orgB.id })).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
  });

  it("MANAGER can act on events (heritage ADMIN) mais pas sur les infos org", async () => {
    const mgr = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-mgr" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-mgr-e", location: "", date: new Date() },
    });
    await prisma.orgMembership.create({ data: { userId: mgr.id, orgId: org.id, role: "MANAGER" } });

    const target = eventTargetOf({ eventId: event.id, orgId: org.id });
    await expect(requirePermission(mgr.id, "event.update", target)).resolves.toBeUndefined();
    await expect(requirePermission(mgr.id, "registration.delete", target)).resolves.toBeUndefined();
    await expect(requirePermission(mgr.id, "org.update", { kind: "org", orgId: org.id })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(requirePermission(mgr.id, "org.events.create", { kind: "org", orgId: org.id })).resolves.toBeUndefined();
  });

  it("AUDITOR sees aggregated event data but no detail nor mutation", async () => {
    const aud = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-aud" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-aud-e", location: "", date: new Date() },
    });
    await prisma.orgMembership.create({ data: { userId: aud.id, orgId: org.id, role: "AUDITOR" } });

    const target = eventTargetOf({ eventId: event.id, orgId: org.id });
    await expect(requirePermission(aud.id, "org.read", { kind: "org", orgId: org.id })).resolves.toBeUndefined();
    await expect(requirePermission(aud.id, "org.events.create", { kind: "org", orgId: org.id })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(requirePermission(aud.id, "event.read.aggregated", target)).resolves.toBeUndefined();
    await expect(requirePermission(aud.id, "event.read.detailed", target)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(requirePermission(aud.id, "registration.approve", target)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("PRINTER can print badges but cannot approve registrations", async () => {
    const printer = await prisma.user.create({ data: { email: "p@x", password: "x", name: "P" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-pr" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-pr-e", location: "", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: printer.id, eventId: event.id, role: "PRINTER" } });

    const target = eventTargetOf({ eventId: event.id, orgId: org.id });
    await expect(requirePermission(printer.id, "badge.print", target)).resolves.toBeUndefined();
    await expect(requirePermission(printer.id, "registration.approve", target)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(requirePermission(printer.id, "scan.check-in", target)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("VIEWER sees aggregated only, no detail, no badge print", async () => {
    const vw = await prisma.user.create({ data: { email: "v@x", password: "x", name: "V" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "int-vw" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "int-vw-e", location: "", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: vw.id, eventId: event.id, role: "VIEWER" } });

    const target = eventTargetOf({ eventId: event.id, orgId: org.id });
    await expect(requirePermission(vw.id, "event.read.aggregated", target)).resolves.toBeUndefined();
    await expect(requirePermission(vw.id, "event.read.detailed", target)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(requirePermission(vw.id, "badge.print", target)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
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
