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

// ===========================================================
// GET /api/platform/users/[userId]
// ===========================================================

describe("GET /api/platform/users/[userId]", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T" },
    });

    const { GET } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`);
    const res = await GET(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-staff", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x", password: "x", name: "U" },
    });
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${u.id}`);
    const res = await GET(req, { params: Promise.resolve({ userId: u.id }) });
    expect(res.status).toBe(403);
  });

  it("returns user details without password (STAFF_OBSERVER allowed)", async () => {
    await makeStaff("STAFF_OBSERVER");
    const t = await prisma.user.create({
      data: { email: "t@x", password: "SECRET", name: "T" },
    });

    const { GET } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`);
    const res = await GET(req, { params: Promise.resolve({ userId: t.id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user.password).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("SECRET");
  });

  it("returns 404 for unknown user", async () => {
    await makeStaff();

    const { GET } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest("http://localhost/api/platform/users/unknown");
    const res = await GET(req, { params: Promise.resolve({ userId: "unknown" }) });
    expect(res.status).toBe(404);
  });
});

// ===========================================================
// PATCH /api/platform/users/[userId]
// ===========================================================

describe("PATCH /api/platform/users/[userId]", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T" },
    });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Y" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(401);
  });

  it("STAFF_OBSERVER can patch name (200)", async () => {
    await makeStaff("STAFF_OBSERVER");
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "Old" },
    });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(200);
  });

  it("STAFF_SUPPORT cannot change staffRole (403)", async () => {
    await makeStaff("STAFF_SUPPORT");
    const t = await prisma.user.create({
      data: {
        email: "t@x",
        password: "x",
        name: "T",
        isStaff: true,
        staffRole: "STAFF_OBSERVER",
      },
    });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ staffRole: "STAFF_SUPPORT" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN cannot change own staffRole (403)", async () => {
    const self = await prisma.user.create({
      data: {
        email: "self@x",
        password: "x",
        name: "Self",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
      },
    });
    withSession({ id: self.id, email: self.email, name: self.name, isStaff: true });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${self.id}`, {
      method: "PATCH",
      body: JSON.stringify({ staffRole: "STAFF_OBSERVER" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: self.id }) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN can change another staff's role to STAFF_SUPPORT + logs USER_UPDATED", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({
      data: {
        email: "t@x",
        password: "x",
        name: "T",
        isStaff: true,
        staffRole: "STAFF_OBSERVER",
      },
    });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ staffRole: "STAFF_SUPPORT" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: t.id } });
    expect(updated?.staffRole).toBe("STAFF_SUPPORT");

    const log = await prisma.activityLog.findFirst({ where: { type: "USER_UPDATED" } });
    expect(log).not.toBeNull();
  });

  it("STAFF_ADMIN cannot promote to STAFF_ADMIN (403, SUPER_ADMIN only)", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({
      data: {
        email: "t@x",
        password: "x",
        name: "T",
        isStaff: true,
        staffRole: "STAFF_SUPPORT",
      },
    });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ staffRole: "STAFF_ADMIN" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN cannot promote to SUPER_ADMIN (403)", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({
      data: {
        email: "t@x",
        password: "x",
        name: "T",
        isStaff: true,
        staffRole: "STAFF_SUPPORT",
      },
    });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ staffRole: "SUPER_ADMIN" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN cannot demote an existing STAFF_ADMIN (403)", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({
      data: {
        email: "t@x",
        password: "x",
        name: "T",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
      },
    });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ staffRole: "STAFF_SUPPORT" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(403);
  });

  it("SUPER_ADMIN can promote another to STAFF_ADMIN (200)", async () => {
    await makeStaff("SUPER_ADMIN");
    const t = await prisma.user.create({
      data: {
        email: "t@x",
        password: "x",
        name: "T",
        isStaff: true,
        staffRole: "STAFF_SUPPORT",
      },
    });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ staffRole: "STAFF_ADMIN" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: t.id } });
    expect(updated?.staffRole).toBe("STAFF_ADMIN");
  });

  it("archiving the last SUPER_ADMIN returns 409 (LAST_SUPER_ADMIN)", async () => {
    // Actor STAFF_ADMIN peut patcher archived. La cible est l'unique SUPER_ADMIN
    // actif -> assertNotLastSuperAdmin doit jeter LAST_SUPER_ADMIN (409).
    await makeStaff("STAFF_ADMIN");

    const target = await prisma.user.create({
      data: {
        email: "lonely-sa@x",
        password: "x",
        name: "Lonely SA",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
      },
    });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${target.id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: target.id }) });
    expect(res.status).toBe(409);
  });

  it("returns 404 for unknown user on PATCH", async () => {
    await makeStaff("STAFF_ADMIN");

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest("http://localhost/api/platform/users/unknown", {
      method: "PATCH",
      body: JSON.stringify({ name: "Y" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: "unknown" }) });
    expect(res.status).toBe(404);
  });
});

// ===========================================================
// POST /api/platform/users/[userId]/reset-password
// ===========================================================

describe("POST /api/platform/users/[userId]/reset-password", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T" },
    });

    const { POST } = await import("@/app/api/platform/users/[userId]/reset-password/route");
    const req = new NextRequest(
      `http://localhost/api/platform/users/${t.id}/reset-password`,
      { method: "POST" },
    );
    const res = await POST(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(401);
  });

  it("STAFF_OBSERVER cannot reset password (403)", async () => {
    await makeStaff("STAFF_OBSERVER");
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T" },
    });

    const { POST } = await import("@/app/api/platform/users/[userId]/reset-password/route");
    const req = new NextRequest(
      `http://localhost/api/platform/users/${t.id}/reset-password`,
      { method: "POST" },
    );
    const res = await POST(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(403);
  });

  it("STAFF_SUPPORT can reset password : token regenerated + log USER_PASSWORD_SET", async () => {
    await makeStaff("STAFF_SUPPORT");
    const t = await prisma.user.create({
      data: { email: "t@x", password: "old", name: "T" },
    });

    const { POST } = await import("@/app/api/platform/users/[userId]/reset-password/route");
    const req = new NextRequest(
      `http://localhost/api/platform/users/${t.id}/reset-password`,
      { method: "POST" },
    );
    const res = await POST(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(200);

    const after = await prisma.user.findUnique({
      where: { id: t.id },
      select: { inviteToken: true, inviteTokenExpiry: true },
    });
    expect(after?.inviteToken).toBeTruthy();
    expect(after?.inviteToken?.length).toBeGreaterThan(20);
    expect(after?.inviteTokenExpiry).not.toBeNull();

    const log = await prisma.activityLog.findFirst({
      where: { type: "USER_PASSWORD_SET", targetId: t.id },
    });
    expect(log).not.toBeNull();
  });

  it("returns 404 for unknown user on reset-password", async () => {
    await makeStaff("STAFF_SUPPORT");

    const { POST } = await import("@/app/api/platform/users/[userId]/reset-password/route");
    const req = new NextRequest(
      "http://localhost/api/platform/users/unknown/reset-password",
      { method: "POST" },
    );
    const res = await POST(req, { params: Promise.resolve({ userId: "unknown" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when user is archived", async () => {
    await makeStaff("STAFF_SUPPORT");
    const t = await prisma.user.create({
      data: {
        email: "z@x",
        password: "x",
        name: "Z",
        archived: true,
        archivedAt: new Date(),
      },
    });

    const { POST } = await import("@/app/api/platform/users/[userId]/reset-password/route");
    const req = new NextRequest(
      `http://localhost/api/platform/users/${t.id}/reset-password`,
      { method: "POST" },
    );
    const res = await POST(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(400);
  });
});

// ===========================================================
// DELETE /api/platform/users/[userId] (soft-delete)
// ===========================================================

describe("DELETE /api/platform/users/[userId]", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T" },
    });

    const { DELETE } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(401);
  });

  it("STAFF_SUPPORT cannot soft-delete (403)", async () => {
    await makeStaff("STAFF_SUPPORT");
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T" },
    });

    const { DELETE } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN can soft-delete : archived=true + log USER_DELETED (204)", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T" },
    });

    const { DELETE } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(204);

    const after = await prisma.user.findUnique({ where: { id: t.id } });
    expect(after?.archived).toBe(true);
    expect(after?.archivedAt).not.toBeNull();

    const log = await prisma.activityLog.findFirst({
      where: { type: "USER_DELETED", targetId: t.id },
    });
    expect(log).not.toBeNull();
  });

  it("cannot soft-delete self (403)", async () => {
    const self = await prisma.user.create({
      data: {
        email: "self@x",
        password: "x",
        name: "Self",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
      },
    });
    withSession({ id: self.id, email: self.email, name: self.name, isStaff: true });

    const { DELETE } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${self.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ userId: self.id }) });
    expect(res.status).toBe(403);
  });

  it("returns 409 when soft-deleting the last SUPER_ADMIN", async () => {
    await makeStaff("STAFF_ADMIN");
    const sa = await prisma.user.create({
      data: {
        email: "lone-sa@x",
        password: "x",
        name: "Lone SA",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
      },
    });

    const { DELETE } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${sa.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ userId: sa.id }) });
    expect(res.status).toBe(409);
  });

  it("returns 404 for unknown user on DELETE", async () => {
    await makeStaff("STAFF_ADMIN");

    const { DELETE } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest("http://localhost/api/platform/users/unknown", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ userId: "unknown" }) });
    expect(res.status).toBe(404);
  });
});
