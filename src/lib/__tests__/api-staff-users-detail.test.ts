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

  it("returns 403 NOT_STAFF when the handler's own loadUserContext lookup finds a non-staff user", async () => {
    // Meme technique que pour POST /platform/users : withStaffAuth valide deja
    // isStaff/staffRole via un premier appel prisma.user.findUnique (mocke ici en
    // staff), le second appel (dans le handler PATCH) retombe sur l'implementation
    // reelle et retrouve l'utilisateur non-staff effectivement seede en base.
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

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${u.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: u.id }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("NOT_STAFF");
    spy.mockRestore();
  });

  it("returns 400 on malformed JSON body", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T" },
    });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 NOTHING_TO_UPDATE for an empty body", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T" },
    });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("NOTHING_TO_UPDATE");
  });

  it("sets archivedAt when archiving a non-SUPER_ADMIN target (200)", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T" },
    });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: t.id } });
    expect(updated?.archived).toBe(true);
    expect(updated?.archivedAt).not.toBeNull();
  });

  it("clears archivedAt when unarchiving a target (200)", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({
      data: {
        email: "t@x",
        password: "x",
        name: "T",
        archived: true,
        archivedAt: new Date(),
      },
    });

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: false }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: t.id } });
    expect(updated?.archived).toBe(false);
    expect(updated?.archivedAt).toBeNull();
  });

  it("returns 409 LAST_SUPER_ADMIN when demoting the sole SUPER_ADMIN's staffRole (forced via spy)", async () => {
    // Le flux naturel ne peut pas atteindre cette branche : seul un SUPER_ADMIN peut
    // demoter un SUPER_ADMIN (garde involvesTopRoles), et cet acteur compte alors
    // lui-meme comme SUPER_ADMIN restant dans assertNotLastSuperAdmin. On force donc
    // artificiellement prisma.user.count (utilise par assertNotLastSuperAdmin) a
    // renvoyer 0 pour simuler "plus aucun autre SUPER_ADMIN actif".
    await makeStaff("SUPER_ADMIN");
    const t = await prisma.user.create({
      data: {
        email: "t@x",
        password: "x",
        name: "T",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
      },
    });

    const spy = vi.spyOn(prisma.user, "count").mockResolvedValueOnce(0);

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ staffRole: "STAFF_ADMIN" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("LAST_SUPER_ADMIN");
    spy.mockRestore();
  });

  it("rethrows a non-AuthError raised by assertNotLastSuperAdmin during staffRole demotion", async () => {
    await makeStaff("SUPER_ADMIN");
    const t = await prisma.user.create({
      data: {
        email: "t@x",
        password: "x",
        name: "T",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
      },
    });

    const spy = vi.spyOn(prisma.user, "count").mockRejectedValueOnce(new Error("boom"));

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ staffRole: "STAFF_ADMIN" }),
      headers: { "content-type": "application/json" },
    });
    await expect(
      PATCH(req, { params: Promise.resolve({ userId: t.id }) }),
    ).rejects.toThrow("boom");
    spy.mockRestore();
  });

  it("rethrows a non-AuthError raised by assertNotLastSuperAdmin during archive", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({
      data: {
        email: "t@x",
        password: "x",
        name: "T",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
      },
    });

    const spy = vi.spyOn(prisma.user, "count").mockRejectedValueOnce(new Error("boom"));

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
      headers: { "content-type": "application/json" },
    });
    await expect(
      PATCH(req, { params: Promise.resolve({ userId: t.id }) }),
    ).rejects.toThrow("boom");
    spy.mockRestore();
  });

  it("rethrows prisma.user.update errors whose code is not P2025 (else branch of if(code===P2025))", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T" },
    });

    const spy = vi
      .spyOn(prisma.user, "update")
      .mockRejectedValueOnce(Object.assign(new Error("fk violation"), { code: "P2003" }));

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "content-type": "application/json" },
    });
    await expect(
      PATCH(req, { params: Promise.resolve({ userId: t.id }) }),
    ).rejects.toThrow("fk violation");
    spy.mockRestore();
  });

  it("returns 404 (P2025) when the target is deleted concurrently before update", async () => {
    await makeStaff("STAFF_ADMIN");
    const t = await prisma.user.create({
      data: { email: "t@x", password: "x", name: "T" },
    });

    const spy = vi
      .spyOn(prisma.user, "update")
      .mockRejectedValueOnce(Object.assign(new Error("gone"), { code: "P2025" }));

    const { PATCH } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ userId: t.id }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("NOT_FOUND");
    spy.mockRestore();
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

  it("rethrows a non-AuthError raised by assertNotLastSuperAdmin on DELETE", async () => {
    await makeStaff("STAFF_ADMIN");
    const sa = await prisma.user.create({
      data: {
        email: "sa@x",
        password: "x",
        name: "SA",
        isStaff: true,
        staffRole: "SUPER_ADMIN",
      },
    });

    const spy = vi.spyOn(prisma.user, "count").mockRejectedValueOnce(new Error("boom"));

    const { DELETE } = await import("@/app/api/platform/users/[userId]/route");
    const req = new NextRequest(`http://localhost/api/platform/users/${sa.id}`, {
      method: "DELETE",
    });
    await expect(
      DELETE(req, { params: Promise.resolve({ userId: sa.id }) }),
    ).rejects.toThrow("boom");
    spy.mockRestore();
  });
});
