import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/mail", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mail")>("@/lib/mail");
  return {
    ...actual,
    sendUserInvitation: vi.fn(async () => undefined),
    sendSmtpTest: vi.fn(async () => undefined),
  };
});

import { sendUserInvitation } from "@/lib/mail";

describe("OWNER journey (smoke)", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.category.deleteMany();
    await prisma.event.deleteMany();
    await prisma.categoryTemplate.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
    vi.mocked(sendUserInvitation).mockClear();
  });

  it("OWNER creates event, invites OWNER, archives event", async () => {
    const owner = await prisma.user.create({
      data: { email: "owner@acme.test", password: "x", name: "O" },
    });
    const org = await prisma.organization.create({
      data: { name: "Acme", slug: "acme" },
    });
    const plan = await prisma.plan.create({
      data: { name: "plan-acme", maxEvents: 10, maxParticipantsPerEvent: null },
    });
    await prisma.subscription.create({
      data: { orgId: org.id, planId: plan.id, status: "ACTIVE" },
    });
    await prisma.orgMembership.create({
      data: { userId: owner.id, orgId: org.id, role: "OWNER" },
    });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: owner.id, email: owner.email, name: owner.name, isStaff: false },
    } as never);

    const { POST: createEvent } = await import("@/app/api/org/[orgId]/events/route");
    const r1 = await createEvent(
      new NextRequest(`http://localhost/api/org/${org.id}/events`, {
        method: "POST",
        body: JSON.stringify({ title: "Conf 2026", location: "Paris", date: "2026-12-15" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(r1.status).toBe(201);
    const eventCreated = (await r1.json()) as { event: { id: string; slug: string } };
    expect(eventCreated.event.slug).toBe("conf-2026");

    const { POST: inviteOwner } = await import("@/app/api/org/[orgId]/members/route");
    const r2 = await inviteOwner(
      new NextRequest(`http://localhost/api/org/${org.id}/members`, {
        method: "POST",
        body: JSON.stringify({ email: "bob@acme.test", name: "Bob" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(r2.status).toBe(201);
    expect(vi.mocked(sendUserInvitation)).toHaveBeenCalledTimes(1);

    const { POST: archive } = await import(
      "@/app/api/org/[orgId]/events/[eventId]/archive/route"
    );
    const r3 = await archive(
      new NextRequest(
        `http://localhost/api/org/${org.id}/events/${eventCreated.event.id}/archive`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ orgId: org.id, eventId: eventCreated.event.id }) },
    );
    expect(r3.status).toBe(200);
    const archived = await prisma.event.findUnique({ where: { id: eventCreated.event.id } });
    expect(archived?.archived).toBe(true);

    const logs = await prisma.activityLog.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => l.type)).toEqual(
      expect.arrayContaining([
        "EVENT_CREATED",
        "MEMBERSHIP_ADDED",
        "USER_CREATED",
        "EVENT_ARCHIVED",
      ]),
    );
    expect(logs.every((l) => !l.staffActor)).toBe(true);
  });

  it("staff acting on org produces staffActor=true logs", async () => {
    const staff = await prisma.user.create({
      data: {
        email: "staff@acme.test",
        password: "x",
        name: "S",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
      },
    });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "acme-s" } });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: staff.id, email: staff.email, name: staff.name, isStaff: true },
    } as never);

    const { PATCH } = await import("@/app/api/org/[orgId]/route");
    await PATCH(
      new NextRequest(`http://localhost/api/org/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Acme-2" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id }) },
    );

    const log = await prisma.activityLog.findFirst({ where: { type: "ORG_UPDATED" } });
    expect(log?.staffActor).toBe(true);
  });
});
