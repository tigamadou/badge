import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

function withSession(user: {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
}) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function makeStaff(staffRole: StaffRoleStr = "STAFF_ADMIN") {
  const u = await prisma.user.create({
    data: {
      email: `s-${Date.now()}-${Math.random()}@x`,
      password: "x",
      name: "Staff",
      isStaff: true,
      staffRole,
    },
  });
  withSession({ id: u.id, email: u.email, name: u.name, isStaff: true });
  return u;
}

async function cleanDb() {
  await prisma.activityLog.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

function uniqueSlug(prefix = "o") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

describe("POST /api/platform/users", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 when no session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({ email: "x@y.com", name: "X", type: "client" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("STAFF_OBSERVER cannot create (403)", async () => {
    await makeStaff("STAFF_OBSERVER");

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({ email: "x@y.com", name: "X", type: "client" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_SUPPORT cannot create staff user (403)", async () => {
    await makeStaff("STAFF_SUPPORT");

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({
        email: "new-staff@x.com",
        name: "New Staff",
        type: "staff",
        staffRole: "STAFF_OBSERVER",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_SUPPORT can create client user (201)", async () => {
    await makeStaff("STAFF_SUPPORT");

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({ email: "client@x.com", name: "Client", type: "client" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "client@x.com" } });
    expect(created?.isStaff).toBe(false);
  });

  it("STAFF_ADMIN cannot create STAFF_ADMIN (403)", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({
        email: "promo@x.com",
        name: "Promo",
        type: "staff",
        staffRole: "STAFF_ADMIN",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN cannot create SUPER_ADMIN (403)", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({
        email: "sa@x.com",
        name: "SA",
        type: "staff",
        staffRole: "SUPER_ADMIN",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN can create STAFF_SUPPORT (201)", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({
        email: "supp@x.com",
        name: "Supp",
        type: "staff",
        staffRole: "STAFF_SUPPORT",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "supp@x.com" } });
    expect(created?.isStaff).toBe(true);
    expect(created?.staffRole).toBe("STAFF_SUPPORT");
  });

  it("STAFF_ADMIN can create STAFF_OBSERVER (201)", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({
        email: "obs@x.com",
        name: "Obs",
        type: "staff",
        staffRole: "STAFF_OBSERVER",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "obs@x.com" } });
    expect(created?.staffRole).toBe("STAFF_OBSERVER");
  });

  it("SUPER_ADMIN can create STAFF_ADMIN (201)", async () => {
    await makeStaff("SUPER_ADMIN");

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@x.com",
        name: "Admin",
        type: "staff",
        staffRole: "STAFF_ADMIN",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "admin@x.com" } });
    expect(created?.staffRole).toBe("STAFF_ADMIN");
  });

  it("SUPER_ADMIN can create SUPER_ADMIN (201)", async () => {
    await makeStaff("SUPER_ADMIN");

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({
        email: "newsa@x.com",
        name: "SA",
        type: "staff",
        staffRole: "SUPER_ADMIN",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "newsa@x.com" } });
    expect(created?.staffRole).toBe("SUPER_ADMIN");
  });

  it("creates client linked to org via orgId + orgRole", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({
      data: { name: "Linked", slug: uniqueSlug("linked") },
    });

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({
        email: "linked@x.com",
        name: "Linked",
        type: "client",
        orgId: org.id,
        orgRole: "OWNER",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "linked@x.com" } });
    const m = await prisma.orgMembership.findFirst({
      where: { userId: created!.id, orgId: org.id },
    });
    expect(m?.role).toBe("OWNER");
  });

  it("logs USER_CREATED (+ MEMBERSHIP_ADDED when linked to org)", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({
      data: { name: "L", slug: uniqueSlug("logged") },
    });

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({
        email: "log@x.com",
        name: "Log",
        type: "client",
        orgId: org.id,
        orgRole: "OWNER",
      }),
      headers: { "content-type": "application/json" },
    });
    await POST(req, { params: Promise.resolve({}) });

    const types = (await prisma.activityLog.findMany({ select: { type: true } })).map(
      (l) => l.type,
    );
    expect(types).toContain("USER_CREATED");
    expect(types).toContain("MEMBERSHIP_ADDED");
  });

  it("generates inviteToken on the created User", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({ email: "invite@x.com", name: "Invite", type: "client" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({
      where: { email: "invite@x.com" },
      select: { inviteToken: true, inviteTokenExpiry: true },
    });
    expect(created?.inviteToken).toBeTruthy();
    expect(created?.inviteToken?.length).toBeGreaterThan(20);
    expect(created?.inviteTokenExpiry).not.toBeNull();
  });

  it("returns 409 on duplicate email", async () => {
    await makeStaff("STAFF_ADMIN");
    await prisma.user.create({
      data: { email: "dup@x.com", password: "x", name: "Dup" },
    });

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({ email: "dup@x.com", name: "Dup2", type: "client" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(409);
  });

  it("returns 400 on invalid body (missing fields)", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", type: "client" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when staff type without staffRole", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({ email: "x@y", name: "X", type: "staff" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON body", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("returns 403 NOT_STAFF when the handler's own loadUserContext lookup finds a non-staff user", async () => {
    // withStaffAuth() valide deja isStaff/staffRole en amont : pour atteindre la
    // verification redondante `!ctx.isStaff || !ctx.staffRole` du handler (ligne
    // 102-103), on force artificiellement le premier appel prisma.user.findUnique
    // (consomme par requireStaff) a renvoyer un profil staff, alors que l'utilisateur
    // reel en base est un simple client : le second appel (dans le handler) retombe
    // sur l'implementation reelle et retrouve ce profil non-staff.
    const u = await prisma.user.create({
      data: { email: `notstaff-${Date.now()}@x`, password: "x", name: "NotStaff" },
    });
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const spy = vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce({
      id: u.id,
      email: u.email,
      name: u.name,
      isStaff: true,
      staffRole: "STAFF_ADMIN",
      archived: false,
      platformRole: null,
      orgMemberships: [],
      eventMemberships: [],
      permissionOverrides: [],
    } as never);

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({ email: "z@x.com", name: "Z", type: "client" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("NOT_STAFF");
    spy.mockRestore();
  });

  it("creates client with multiple orgMemberships entries", async () => {
    await makeStaff("STAFF_ADMIN");
    const org1 = await prisma.organization.create({
      data: { name: "Org1", slug: uniqueSlug("org1") },
    });
    const org2 = await prisma.organization.create({
      data: { name: "Org2", slug: uniqueSlug("org2") },
    });

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({
        email: "multi@x.com",
        name: "Multi",
        type: "client",
        orgMemberships: [
          { orgId: org1.id, role: "MANAGER" },
          { orgId: org2.id, role: "AUDITOR" },
        ],
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "multi@x.com" } });
    const memberships = await prisma.orgMembership.findMany({
      where: { userId: created!.id },
      orderBy: { orgId: "asc" },
    });
    expect(memberships.length).toBe(2);
    expect(memberships.map((m) => m.role).sort()).toEqual(["AUDITOR", "MANAGER"]);
  });

  it("defaults orgRole to OWNER when orgId is given without orgRole", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({
      data: { name: "DefaultRole", slug: uniqueSlug("defrole") },
    });

    const { POST } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users", {
      method: "POST",
      body: JSON.stringify({
        email: "defrole@x.com",
        name: "DefRole",
        type: "client",
        orgId: org.id,
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const created = await prisma.user.findUnique({ where: { email: "defrole@x.com" } });
    const m = await prisma.orgMembership.findFirst({
      where: { userId: created!.id, orgId: org.id },
    });
    expect(m?.role).toBe("OWNER");
  });
});
