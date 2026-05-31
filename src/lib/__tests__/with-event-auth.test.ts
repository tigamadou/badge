import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function setup() {
  const org = await prisma.organization.create({
    data: { name: "Org", slug: `org-${Date.now()}` },
  });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Evt",
      slug: `evt-${Date.now()}`,
      location: "L",
      date: new Date(),
    },
  });
  return { org, event };
}

function mockSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

describe("withEventAuth", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 when no session", async () => {
    const { org, event } = await setup();
    vi.mocked(getServerSession).mockResolvedValue(null);
    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when event does not exist", async () => {
    const { org } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/missing`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to a different org (URL tampering)", async () => {
    const { event } = await setup();
    const otherOrg = await prisma.organization.create({ data: { name: "Other", slug: "other" } });
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${otherOrg.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: otherOrg.id, eventId: event.id }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 for user with no membership and not staff", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(403);
  });

  it("passes for OPERATOR membership when OPERATOR required", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "OPERATOR" },
    });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    let captured: { eventId: string; orgId: string; effectiveRole: string | null } | null = null;
    const handler = withEventAuth({ minRole: "OPERATOR" }, async (_req, ctx) => {
      captured = { eventId: ctx.eventId, orgId: ctx.orgId, effectiveRole: ctx.effectiveRole };
      return new Response("ok");
    });
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });

    expect(res.status).toBe(200);
    expect(captured).toEqual({ eventId: event.id, orgId: org.id, effectiveRole: "OPERATOR" });
  });

  it("rejects OPERATOR for ADMIN-required route (defense in depth)", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "OPERATOR" },
    });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth({ minRole: "ADMIN" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(403);
  });

  it("OWNER of parent org inherits ADMIN on event", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "owner@x", password: "x", name: "O" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    let captured: string | null = null;
    const handler = withEventAuth({ minRole: "ADMIN" }, async (_req, ctx) => {
      captured = ctx.effectiveRole;
      return new Response("ok");
    });
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(200);
    expect(captured).toBe("ADMIN");
  });

  it("staff bypass", async () => {
    const { org, event } = await setup();
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_SUPPORT" },
    });
    mockSession({ id: s.id, email: s.email, name: s.name, isStaff: true });

    let captured: string | null = null;
    const handler = withEventAuth({ minRole: "ADMIN" }, async (_req, ctx) => {
      captured = ctx.effectiveRole;
      return new Response("ok");
    });
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(200);
    expect(captured).toBe("STAFF");
  });

  it("refuses archived event by default", async () => {
    const { org, event } = await setup();
    await prisma.event.update({ where: { id: event.id }, data: { archived: true } });
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "ADMIN" },
    });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth({ minRole: "OPERATOR" }, async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.code).toBe("EVENT_ARCHIVED");
  });

  it("allowArchived=true lets archived events through", async () => {
    const { org, event } = await setup();
    await prisma.event.update({ where: { id: event.id }, data: { archived: true } });
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "ADMIN" },
    });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth(
      { minRole: "OPERATOR", allowArchived: true },
      async () => new Response("ok"),
    );
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(200);
  });

  it("requireRegistrationOpen=true blocks closed events", async () => {
    const { org, event } = await setup();
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "ADMIN" },
    });
    mockSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const handler = withEventAuth(
      { minRole: "ADMIN", requireRegistrationOpen: true },
      async () => new Response("ok"),
    );
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`);
    const res = await handler(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("REGISTRATION_CLOSED");
  });
});
