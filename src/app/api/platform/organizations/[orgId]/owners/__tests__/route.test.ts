import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { systemRoleId } from "@/lib/permissions/db";

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
        body: JSON.stringify({ email: "newmgr@x.com", name: "New Manager", roleId: await systemRoleId(prisma, "MANAGER") }),
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
        body: JSON.stringify({ email: "already@x.com", name: "Already", roleId: await systemRoleId(prisma, "OWNER") }),
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
      body: JSON.stringify({ email: "norole@x.com", name: "NoRole", roleId: await systemRoleId(prisma, "OWNER") }),
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
        body: JSON.stringify({ email: "upgrade@x.com", name: "Upgrade", roleId: await systemRoleId(prisma, "OWNER") }),
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

describe("POST /api/platform/organizations/[orgId]/owners : rôles par roleId", () => {
  const call = async (orgId: string, body: unknown) => {
    const { POST } = await import("@/app/api/platform/organizations/[orgId]/owners/route");
    return POST(
      new NextRequest(`http://localhost/api/platform/organizations/${orgId}/owners`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId }) },
    );
  };

  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("sans roleId : propriétaire ; avec un rôle personnalisé de l'organisation : accepté, sans enum", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    expect((await call(org.id, { email: "a@x.com", name: "A" })).status).toBe(201);
    const a = await prisma.user.findUniqueOrThrow({ where: { email: "a@x.com" } });
    expect(await prisma.orgMembership.findFirstOrThrow({ where: { userId: a.id }, include: { roleRef: true } })).toMatchObject({
      role: "OWNER",
      roleRef: { systemKey: "OWNER" },
    });
    const custom = await prisma.role.create({ data: { scope: "ORG", orgId: org.id, name: "Comptable" } });
    expect((await call(org.id, { email: "b@x.com", name: "B", roleId: custom.id })).status).toBe(201);
    const b = await prisma.user.findUniqueOrThrow({ where: { email: "b@x.com" } });
    expect(await prisma.orgMembership.findFirstOrThrow({ where: { userId: b.id } })).toMatchObject({ roleId: custom.id, role: null });
    const list = await (async () => {
      const { GET } = await import("@/app/api/platform/organizations/[orgId]/owners/route");
      return (
        await GET(new NextRequest("http://localhost/x"), { params: Promise.resolve({ orgId: org.id }) })
      ).json();
    })();
    expect(list.owners).toHaveLength(1);
    expect(list.owners[0].role).toMatchObject({ systemKey: "OWNER" });
  });

  it("rôle d'une autre organisation : 404 ; rôle plateforme : 400 ; membre inchangé", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const other = await prisma.organization.create({ data: { name: "Y", slug: uniqueSlug() } });
    const foreign = await prisma.role.create({ data: { scope: "ORG", orgId: other.id, name: "Étranger" } });
    const platform = await prisma.role.create({ data: { scope: "PLATFORM", name: "Plateforme perso" } });
    expect((await call(org.id, { email: "c@x.com", name: "C", roleId: foreign.id })).status).toBe(404);
    expect((await call(org.id, { email: "c@x.com", name: "C", roleId: platform.id })).status).toBe(400);
    expect(await prisma.user.count({ where: { email: "c@x.com" } })).toBe(0);
  });

  it("anti-escalade : rôle personnalisé non détenu refusé au STAFF_ADMIN ; le SUPER_ADMIN l'attribue", async () => {
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const payer = await prisma.role.create({
      data: { scope: "ORG", orgId: org.id, name: "Payeur", permissions: { create: [{ permission: "billing.subscription.pay" }] } },
    });
    await makeStaff("STAFF_ADMIN");
    const refused = await call(org.id, { email: "d@x.com", name: "D", roleId: payer.id });
    expect([refused.status, (await refused.json()).error]).toEqual([403, "PERMISSION_NOT_HELD"]);
    await makeStaff("SUPER_ADMIN");
    expect((await call(org.id, { email: "d@x.com", name: "D", roleId: payer.id })).status).toBe(201);
  });

  it("rétrograder le dernier propriétaire : 409 LAST_OWNER ; avec un second propriétaire : autorisé", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const owner = await prisma.user.create({ data: { email: "o@x.com", password: "x", name: "O" } });
    await prisma.orgMembership.create({ data: { userId: owner.id, orgId: org.id, role: "OWNER", roleId: await systemRoleId(prisma, "OWNER") } });
    const manager = await systemRoleId(prisma, "MANAGER");
    const refused = await call(org.id, { email: "o@x.com", name: "O", roleId: manager });
    expect([refused.status, (await refused.json()).error]).toEqual([409, "LAST_OWNER"]);
    const second = await prisma.user.create({ data: { email: "o2@x.com", password: "x", name: "O2" } });
    await prisma.orgMembership.create({ data: { userId: second.id, orgId: org.id, role: "OWNER", roleId: await systemRoleId(prisma, "OWNER") } });
    expect((await call(org.id, { email: "o@x.com", name: "O", roleId: manager })).status).toBe(200);
  });

  it("le staff ne change pas son propre rôle d'organisation (403)", async () => {
    const staff = await prisma.user.update({ where: { id: (await makeStaff("STAFF_ADMIN")).id }, data: { email: "self-staff@x.com" } });
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    await prisma.orgMembership.create({ data: { userId: staff.id, orgId: org.id, role: "AUDITOR", roleId: await systemRoleId(prisma, "AUDITOR") } });
    const res = await call(org.id, { email: staff.email, name: "S", roleId: await systemRoleId(prisma, "OWNER") });
    expect([res.status, (await res.json()).error]).toEqual([403, "SELF_MODIFICATION"]);
  });

  it("un staff peut s'ajouter lui-même comme nouveau membre", async () => {
    const staff = await prisma.user.update({ where: { id: (await makeStaff("STAFF_ADMIN")).id }, data: { email: "ajout-staff@x.com" } });
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    expect((await call(org.id, { email: staff.email, name: "S", roleId: await systemRoleId(prisma, "AUDITOR") })).status).toBe(201);
  });

  it("corps invalide (champ inconnu `role`) : 400", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    expect((await call(org.id, { email: "e@x.com", name: "E", role: "MANAGER" })).status).toBe(400);
  });
});
