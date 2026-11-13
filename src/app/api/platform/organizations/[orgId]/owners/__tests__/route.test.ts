import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

// Mock partiel : permet de forcer un echec de sendUserInvitation pour couvrir
// le catch qui l'avale (route.ts lignes 142-147), sans dependre d'un vrai SMTP.
vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return { ...actual, sendUserInvitation: vi.fn(actual.sendUserInvitation) };
});
import { sendUserInvitation } from "@/lib/mail";

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
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

function uniqueSlug(prefix = "o") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

describe("GET /api/platform/organizations/[orgId]/owners", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });

    const { GET } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
    );
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-staff", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });

    const { GET } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
    );
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown org", async () => {
    await makeStaff();

    const { GET } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      "http://localhost/api/platform/organizations/unknown/owners",
    );
    const res = await GET(req, { params: Promise.resolve({ orgId: "unknown" }) });
    expect(res.status).toBe(404);
  });

  it("lists OWNER memberships with staff min role STAFF_OBSERVER", async () => {
    await makeStaff("STAFF_OBSERVER");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const owner1 = await prisma.user.create({
      data: { email: "owner1@x.com", password: "x", name: "Owner One" },
    });
    const owner2 = await prisma.user.create({
      data: { email: "owner2@x.com", password: "x", name: "Owner Two" },
    });
    const manager = await prisma.user.create({
      data: { email: "manager@x.com", password: "x", name: "Manager" },
    });
    await prisma.orgMembership.create({
      data: { userId: owner1.id, orgId: org.id, role: "OWNER" },
    });
    await prisma.orgMembership.create({
      data: { userId: owner2.id, orgId: org.id, role: "OWNER" },
    });
    await prisma.orgMembership.create({
      data: { userId: manager.id, orgId: org.id, role: "MANAGER" },
    });

    const { GET } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
    );
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.owners).toHaveLength(2);
    const emails = json.owners.map((o: { email: string }) => o.email).sort();
    expect(emails).toEqual(["owner1@x.com", "owner2@x.com"]);
    expect(json.owners[0]).toMatchObject({
      email: "owner1@x.com",
      name: "Owner One",
      archived: false,
      emailVerified: false,
    });
    expect(json.owners[0].membershipId).toBeDefined();
    expect(json.owners[0].userId).toBe(owner1.id);
    expect(json.owners[0].invitedAt).toBeDefined();
  });
});

describe("POST /api/platform/organizations/[orgId]/owners", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  afterEach(() => {
    vi.mocked(sendUserInvitation).mockClear();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
      {
        method: "POST",
        body: JSON.stringify({ email: "new@x.com", name: "New" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(401);
  });

  it("rejects STAFF_SUPPORT with 403 (below STAFF_ADMIN)", async () => {
    await makeStaff("STAFF_SUPPORT");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
      {
        method: "POST",
        body: JSON.stringify({ email: "new@x.com", name: "New" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("rejects STAFF_OBSERVER with 403", async () => {
    await makeStaff("STAFF_OBSERVER");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
      {
        method: "POST",
        body: JSON.stringify({ email: "new@x.com", name: "New" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown org", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      "http://localhost/api/platform/organizations/unknown/owners",
      {
        method: "POST",
        body: JSON.stringify({ email: "new@x.com", name: "New" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: "unknown" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when the request body is malformed JSON", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
      {
        method: "POST",
        body: "{not-json",
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid body (missing name)", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
      {
        method: "POST",
        body: JSON.stringify({ email: "new@x.com" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);
  });

  it("invites a brand new user as OWNER by default, logs USER_CREATED + MEMBERSHIP_ADDED", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
      {
        method: "POST",
        body: JSON.stringify({ email: "brandnew@x.com", name: "Brand New" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);

    const user = await prisma.user.findUnique({ where: { email: "brandnew@x.com" } });
    expect(user).not.toBeNull();
    expect(user?.inviteToken).not.toBeNull();
    expect(json.userId).toBe(user!.id);

    const membership = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: user!.id, orgId: org.id } },
    });
    expect(membership?.role).toBe("OWNER");

    const userCreatedLog = await prisma.activityLog.findFirst({
      where: { type: "USER_CREATED", targetId: user!.id, orgId: org.id },
    });
    expect(userCreatedLog).not.toBeNull();
    expect(userCreatedLog?.userId).toBe(staff.id);

    const membershipAddedLog = await prisma.activityLog.findFirst({
      where: { type: "MEMBERSHIP_ADDED", targetId: user!.id, orgId: org.id },
    });
    expect(membershipAddedLog).not.toBeNull();

    expect(sendUserInvitation).toHaveBeenCalledWith(user!.id, {
      orgId: org.id,
      role: "OWNER",
    });
  });

  it("invites a brand new user with an explicit role (MANAGER)", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
      {
        method: "POST",
        body: JSON.stringify({ email: "newmgr@x.com", name: "New Manager", role: "MANAGER" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: "newmgr@x.com" } });
    const membership = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: user!.id, orgId: org.id } },
    });
    expect(membership?.role).toBe("MANAGER");
  });

  it("returns alreadyMember when the existing membership already has the requested role", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const existingUser = await prisma.user.create({
      data: { email: "already@x.com", password: "x", name: "Already" },
    });
    await prisma.orgMembership.create({
      data: { userId: existingUser.id, orgId: org.id, role: "OWNER" },
    });

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
      {
        method: "POST",
        body: JSON.stringify({ email: "already@x.com", name: "Already", role: "OWNER" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, alreadyMember: true });

    // Aucun log de changement de role ni d'ajout : le membership est inchange.
    const roleChangedLog = await prisma.activityLog.findFirst({
      where: { type: "MEMBERSHIP_ROLE_CHANGED", targetId: existingUser.id },
    });
    expect(roleChangedLog).toBeNull();
  });

  it("traite une appartenance sans rôle comme AUDITOR dans la notification de changement", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const existingUser = await prisma.user.create({
      data: { email: "norole@x.com", password: "x", name: "NoRole" },
    });
    await prisma.orgMembership.create({
      data: { userId: existingUser.id, orgId: org.id, role: null },
    });

    const { POST } = await import("@/app/api/platform/organizations/[orgId]/owners/route");
    const req = new NextRequest(`http://localhost/api/platform/organizations/${org.id}/owners`, {
      method: "POST",
      body: JSON.stringify({ email: "norole@x.com", name: "NoRole", role: "OWNER" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, upgraded: true });
  });

  it("upgrades the existing membership role and logs MEMBERSHIP_ROLE_CHANGED", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const existingUser = await prisma.user.create({
      data: { email: "upgrade@x.com", password: "x", name: "Upgrade" },
    });
    await prisma.orgMembership.create({
      data: { userId: existingUser.id, orgId: org.id, role: "AUDITOR" },
    });

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
      {
        method: "POST",
        body: JSON.stringify({ email: "upgrade@x.com", name: "Upgrade", role: "OWNER" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, upgraded: true });

    const membership = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: existingUser.id, orgId: org.id } },
    });
    expect(membership?.role).toBe("OWNER");

    const log = await prisma.activityLog.findFirst({
      where: { type: "MEMBERSHIP_ROLE_CHANGED", targetId: existingUser.id, orgId: org.id },
    });
    expect(log).not.toBeNull();
    expect(log?.userId).toBe(staff.id);
    expect(log?.details).toMatchObject({ from: "AUDITOR", to: "OWNER", scope: "org" });
  });

  it("invites as OWNER an existing user who is not yet a member (isNewUser=false): membership created, no email sent", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const existingUser = await prisma.user.create({
      data: { email: "notmember@x.com", password: "x", name: "Not Member" },
    });

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
      {
        method: "POST",
        body: JSON.stringify({ email: "notmember@x.com", name: "Not Member" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.userId).toBe(existingUser.id);

    const membership = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: existingUser.id, orgId: org.id } },
    });
    expect(membership?.role).toBe("OWNER");

    const membershipAddedLog = await prisma.activityLog.findFirst({
      where: { type: "MEMBERSHIP_ADDED", targetId: existingUser.id, orgId: org.id },
    });
    expect(membershipAddedLog).not.toBeNull();
    expect(membershipAddedLog?.details).toMatchObject({ isNewUser: false });

    expect(sendUserInvitation).not.toHaveBeenCalled();
  });

  it("swallows a failed invitation email and still returns 201", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    vi.mocked(sendUserInvitation).mockRejectedValueOnce(new Error("smtp down"));

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners`,
      {
        method: "POST",
        body: JSON.stringify({ email: "mailfail@x.com", name: "Mail Fail" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);

    const user = await prisma.user.findUnique({ where: { email: "mailfail@x.com" } });
    expect(user).not.toBeNull();
  });
});
