import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

describe("logActivity", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  it("auto-derives orgId from eventId", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "ola" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "evt-a", location: "", date: new Date() },
    });
    await logActivity({ type: "REGISTRATION_CREATED", eventId: event.id });
    const log = await prisma.activityLog.findFirst();
    expect(log?.orgId).toBe(org.id);
    expect(log?.eventId).toBe(event.id);
  });

  it("laisse orgId null si l'event reference n'existe pas", async () => {
    await logActivity({ type: "REGISTRATION_CREATED", eventId: "no-such-event" });
    const log = await prisma.activityLog.findFirst();
    expect(log?.eventId).toBe("no-such-event");
    expect(log?.orgId).toBeNull();
  });

  it("marks staffActor=true when actor is staff and target is client data", async () => {
    const staff = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "olb" } });

    await logActivity({ type: "ORG_UPDATED", userId: staff.id, orgId: org.id });
    const log = await prisma.activityLog.findFirst({ where: { type: "ORG_UPDATED" } });
    expect(log?.staffActor).toBe(true);
  });

  it("staffActor=false for platform actions (no orgId)", async () => {
    const staff = await prisma.user.create({
      data: { email: "s2@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await logActivity({ type: "PLATFORM_SETTINGS_UPDATED", userId: staff.id });
    const log = await prisma.activityLog.findFirst({ where: { type: "PLATFORM_SETTINGS_UPDATED" } });
    expect(log?.staffActor).toBe(false);
  });

  it("staffActor=false for non-staff client action", async () => {
    const owner = await prisma.user.create({
      data: { email: "o@x", password: "x", name: "O" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "olc" } });
    await logActivity({ type: "ORG_UPDATED", userId: owner.id, orgId: org.id });
    const log = await prisma.activityLog.findFirst({ where: { type: "ORG_UPDATED" } });
    expect(log?.staffActor).toBe(false);
  });
});
