import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

afterAll(async () => {
  await prisma.activityLog.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

vi.mock("@/lib/mail", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mail")>("@/lib/mail");
  return {
    ...actual,
    sendUserInvitation: vi.fn(async () => undefined),
  };
});
import { sendUserInvitation } from "@/lib/mail";

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function seedAdmin() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await prisma.user.create({ data: { email: `a-${stamp}@x.test`, password: "x", name: "A" } });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${stamp}`, location: "L", date: new Date() },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
  return { u, org, event };
}

async function cleanup() {
  await prisma.activityLog.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  vi.mocked(getServerSession).mockReset();
  vi.mocked(sendUserInvitation).mockClear();
}

describe("POST /api/org/[orgId]/events/[eventId]/members (invite)", () => {
  beforeEach(cleanup);

  it("adds membership when user exists by email", async () => {
    const { u, org, event } = await seedAdmin();
    const existing = await prisma.user.create({ data: { email: "op@x.test", password: "x", name: "Op" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/members/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "op@x.test", role: "OPERATOR" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);

    const m = await prisma.eventMembership.findFirst({ where: { eventId: event.id, userId: existing.id } });
    expect(m?.role).toBe("OPERATOR");
    expect(vi.mocked(sendUserInvitation)).not.toHaveBeenCalled();
  });

  it("creates user + invite when email is new", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/members/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "newuser@x.test", name: "New User", role: "ADMIN" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "newuser@x.test" } });
    expect(created).not.toBeNull();
    expect(created?.inviteToken).toMatch(/^[0-9a-f]{64}$/);
    expect(vi.mocked(sendUserInvitation)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendUserInvitation).mock.calls[0][1]).toMatchObject({ eventId: event.id, role: "ADMIN" });
  });

  it("rejects duplicate membership (409)", async () => {
    const { u, org, event } = await seedAdmin();
    const x = await prisma.user.create({ data: { email: "dup@x.test", password: "x", name: "D" } });
    await prisma.eventMembership.create({ data: { userId: x.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/members/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "dup@x.test", role: "ADMIN" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(409);
  });

  it("OPERATOR cannot invite (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({ data: { email: `op-${stamp}@x.test`, password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-op-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-op-${stamp}`, location: "L", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/members/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "y@x.test", role: "OPERATOR" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/org/[orgId]/events/[eventId]/members/[membershipId]", () => {
  beforeEach(cleanup);

  it("removes membership and logs MEMBERSHIP_REMOVED", async () => {
    const { u, org, event } = await seedAdmin();
    const x = await prisma.user.create({ data: { email: "y@x.test", password: "x", name: "Y" } });
    const m = await prisma.eventMembership.create({ data: { userId: x.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { DELETE } = await import("@/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members/${m.id}`, { method: "DELETE" });
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, membershipId: m.id } as never),
    });
    expect(res.status).toBe(204);
    const log = await prisma.activityLog.findFirst({ where: { type: "MEMBERSHIP_REMOVED" } });
    expect(log?.eventId).toBe(event.id);
  });
});
