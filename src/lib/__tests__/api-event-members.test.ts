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

describe("GET /api/org/[orgId]/events/[eventId]/members", () => {
  beforeEach(cleanup);

  it("lists event members (ADMIN)", async () => {
    const { u, org, event } = await seedAdmin();
    const other = await prisma.user.create({ data: { email: "listed@x.test", password: "x", name: "L" } });
    await prisma.eventMembership.create({ data: { userId: other.id, eventId: event.id, role: "VIEWER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/members/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members`, { method: "GET" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.members).toHaveLength(2);
    expect(json.members.map((m: { user: { id: string } }) => m.user.id).sort()).toEqual(
      [u.id, other.id].sort(),
    );
  });

  it("returns 401 without session", async () => {
    const { org, event } = await seedAdmin();
    vi.mocked(getServerSession).mockResolvedValue(null as never);

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/members/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members`, { method: "GET" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/org/[orgId]/events/[eventId]/members (invite)", () => {
  beforeEach(cleanup);

  it("returns 401 without session", async () => {
    const { org, event } = await seedAdmin();
    vi.mocked(getServerSession).mockResolvedValue(null as never);

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/members/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "z@x.test", role: "OPERATOR" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(401);
  });

  it("still creates the membership when the invite email fails to send", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    vi.mocked(sendUserInvitation).mockRejectedValueOnce(new Error("smtp down"));

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/members/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "mailfail@x.test", role: "VIEWER" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);
    const created = await prisma.user.findUnique({ where: { email: "mailfail@x.test" } });
    expect(created).not.toBeNull();
  });

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

  it("returns 400 VALIDATION on malformed JSON body", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/members/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members`, {
      method: "POST",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION");
  });

  it("rethrows non-P2002 errors from membership creation", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const spy = vi
      .spyOn(prisma.eventMembership, "create")
      .mockRejectedValueOnce(Object.assign(new Error("db-boom"), { code: "P2003" }));

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/members/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "rethrow@x.test", role: "OPERATOR" }),
      headers: { "content-type": "application/json" },
    });
    await expect(POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) })).rejects.toThrow(
      "db-boom",
    );
    spy.mockRestore();
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

describe("PATCH /api/org/[orgId]/events/[eventId]/members/[membershipId]", () => {
  beforeEach(cleanup);

  it("updates the role and logs MEMBERSHIP_ROLE_CHANGED", async () => {
    const { u, org, event } = await seedAdmin();
    const x = await prisma.user.create({ data: { email: "role@x.test", password: "x", name: "R" } });
    const m = await prisma.eventMembership.create({ data: { userId: x.id, eventId: event.id, role: "VIEWER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members/${m.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: "OPERATOR" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, membershipId: m.id } as never),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.membership.role).toBe("OPERATOR");

    const log = await prisma.activityLog.findFirst({ where: { type: "MEMBERSHIP_ROLE_CHANGED" } });
    expect(log?.targetId).toBe(x.id);
    expect((log?.details as { from?: string; to?: string } | null)?.from).toBe("VIEWER");
    expect((log?.details as { from?: string; to?: string } | null)?.to).toBe("OPERATOR");
  });

  it("traite une appartenance sans rôle comme VIEWER dans la notification de changement", async () => {
    const { u, org, event } = await seedAdmin();
    const x = await prisma.user.create({ data: { email: "norole@x.test", password: "x", name: "N" } });
    const m = await prisma.eventMembership.create({ data: { userId: x.id, eventId: event.id, role: null } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members/${m.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: "OPERATOR" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, membershipId: m.id } as never),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).membership.role).toBe("OPERATOR");
  });

  it("returns 400 on malformed JSON body", async () => {
    const { u, org, event } = await seedAdmin();
    const x = await prisma.user.create({ data: { email: "malformed@x.test", password: "x", name: "R" } });
    const m = await prisma.eventMembership.create({ data: { userId: x.id, eventId: event.id, role: "VIEWER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members/${m.id}`, {
      method: "PATCH",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, membershipId: m.id } as never),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid role", async () => {
    const { u, org, event } = await seedAdmin();
    const x = await prisma.user.create({ data: { email: "badrole@x.test", password: "x", name: "R" } });
    const m = await prisma.eventMembership.create({ data: { userId: x.id, eventId: event.id, role: "VIEWER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members/${m.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: "NOT_A_ROLE" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, membershipId: m.id } as never),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when membership does not exist in this event", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members/does-not-exist`, {
      method: "PATCH",
      body: JSON.stringify({ role: "OPERATOR" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, membershipId: "does-not-exist" } as never),
    });
    expect(res.status).toBe(404);
  });

  it("OPERATOR cannot PATCH a role (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({ data: { email: `patchop-${stamp}@x.test`, password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-patchop-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-patchop-${stamp}`, location: "L", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    const x = await prisma.user.create({ data: { email: `target-${stamp}@x.test`, password: "x", name: "T" } });
    const m = await prisma.eventMembership.create({ data: { userId: x.id, eventId: event.id, role: "VIEWER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members/${m.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: "ADMIN" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, membershipId: m.id } as never),
    });
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

  it("returns 404 when membership does not exist in this event", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { DELETE } = await import("@/app/api/org/[orgId]/events/[eventId]/members/[membershipId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/members/does-not-exist`, { method: "DELETE" });
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, eventId: event.id, membershipId: "does-not-exist" } as never),
    });
    expect(res.status).toBe(404);
  });
});
