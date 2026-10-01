import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";

describe("loadUserContext", () => {
  beforeEach(async () => {
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  });

  it("returns staff role for a staff user", async () => {
    const u = await prisma.user.create({
      data: {
        email: "s@x",
        password: "x",
        name: "S",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
      },
    });
    const ctx = await loadUserContext(u.id);
    expect(ctx?.isStaff).toBe(true);
    expect(ctx?.staffRole).toBe("STAFF_ADMIN");
    expect(ctx?.orgMemberships).toEqual([]);
    expect(ctx?.eventMemberships).toEqual([]);
  });

  it("returns memberships for a client user", async () => {
    const org = await prisma.organization.create({ data: { name: "O", slug: "o" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: "e", location: "L", date: new Date() },
    });
    const u = await prisma.user.create({
      data: { email: "u@x", password: "x", name: "U" },
    });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "OPERATOR" },
    });

    const ctx = await loadUserContext(u.id);
    expect(ctx?.isStaff).toBe(false);
    expect(ctx?.staffRole).toBeNull();
    expect(ctx?.orgMemberships).toEqual([{ orgId: org.id, role: "OWNER" }]);
    expect(ctx?.eventMemberships).toEqual([{ eventId: event.id, role: "OPERATOR" }]);
  });

  it("returns null for unknown user", async () => {
    const ctx = await loadUserContext("missing");
    expect(ctx).toBeNull();
  });

  it("returns null for archived user", async () => {
    const u = await prisma.user.create({
      data: {
        email: "a@x",
        password: "x",
        name: "A",
        archived: true,
        archivedAt: new Date(),
      },
    });
    const ctx = await loadUserContext(u.id);
    expect(ctx).toBeNull();
  });
});
