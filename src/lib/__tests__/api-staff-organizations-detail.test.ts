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

// ===========================================================
// GET /api/platform/organizations/[orgId]
// ===========================================================

describe("GET /api/platform/organizations/[orgId]", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const org = await prisma.organization.create({
      data: { name: "X", slug: uniqueSlug() },
    });

    const { GET } = await import("@/app/api/platform/organizations/[orgId]/route");
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
    );
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-staff", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x", password: "x", name: "U" },
    });
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const org = await prisma.organization.create({
      data: { name: "X", slug: uniqueSlug() },
    });

    const { GET } = await import("@/app/api/platform/organizations/[orgId]/route");
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
    );
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("returns org details for STAFF_OBSERVER", async () => {
    await makeStaff("STAFF_OBSERVER");
    const slug = uniqueSlug("detail");
    const org = await prisma.organization.create({
      data: { name: "Detail", slug, legalName: "Detail SARL" },
    });

    const { GET } = await import("@/app/api/platform/organizations/[orgId]/route");
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
    );
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.org.slug).toBe(slug);
    expect(json.org.legalName).toBe("Detail SARL");
    expect(json.org._count).toEqual({ events: 0, memberships: 0 });
  });

  it("returns 404 for unknown org", async () => {
    await makeStaff();

    const { GET } = await import("@/app/api/platform/organizations/[orgId]/route");
    const req = new NextRequest(
      "http://localhost/api/platform/organizations/unknown",
    );
    const res = await GET(req, {
      params: Promise.resolve({ orgId: "unknown" }),
    });
    expect(res.status).toBe(404);
  });
});

// ===========================================================
// PATCH /api/platform/organizations/[orgId]
// ===========================================================

describe("PATCH /api/platform/organizations/[orgId]", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const org = await prisma.organization.create({
      data: { name: "X", slug: uniqueSlug() },
    });

    const { PATCH } = await import("@/app/api/platform/organizations/[orgId]/route");
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: "Y" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(401);
  });

  it("STAFF_OBSERVER cannot patch (403, read-only)", async () => {
    await makeStaff("STAFF_OBSERVER");
    const org = await prisma.organization.create({
      data: { name: "X", slug: uniqueSlug() },
    });

    const { PATCH } = await import("@/app/api/platform/organizations/[orgId]/route");
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: "Y" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(403);
  });

  it("STAFF_SUPPORT cannot patch (403)", async () => {
    await makeStaff("STAFF_SUPPORT");
    const org = await prisma.organization.create({
      data: { name: "X", slug: uniqueSlug() },
    });

    const { PATCH } = await import("@/app/api/platform/organizations/[orgId]/route");
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: "Y" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN updates all admin fields + slug + quotas + logs ORG_UPDATED", async () => {
    await makeStaff("STAFF_ADMIN");
    const slugA = uniqueSlug("old");
    const slugB = uniqueSlug("new");
    const org = await prisma.organization.create({
      data: { name: "Old", slug: slugA },
    });

    const { PATCH } = await import("@/app/api/platform/organizations/[orgId]/route");
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "New",
          slug: slugB,
          legalName: "New SARL",
          addressLine1: "10 rue",
          postalCode: "75002",
          city: "Paris",
          country: "FR",
          taxId: "FR987",
          website: "https://new.example",
          contactEmail: "c@new.example",
          contactPhone: "+33102",
          quotaMaxEvents: 50,
          quotaMaxRegistrations: 1000,
          quotaMaxStorageMB: 512,
        }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({
      where: { id: org.id },
    });
    expect(updated?.name).toBe("New");
    expect(updated?.slug).toBe(slugB);
    expect(updated?.legalName).toBe("New SARL");
    expect(updated?.addressLine1).toBe("10 rue");
    expect(updated?.postalCode).toBe("75002");
    expect(updated?.city).toBe("Paris");
    expect(updated?.country).toBe("FR");
    expect(updated?.taxId).toBe("FR987");
    expect(updated?.website).toBe("https://new.example");
    expect(updated?.contactEmail).toBe("c@new.example");
    expect(updated?.contactPhone).toBe("+33102");
    expect(updated?.quotaMaxEvents).toBe(50);
    expect(updated?.quotaMaxRegistrations).toBe(1000);
    expect(updated?.quotaMaxStorageMB).toBe(512);

    const log = await prisma.activityLog.findFirst({
      where: { type: "ORG_UPDATED", orgId: org.id },
    });
    expect(log).not.toBeNull();
    expect(log?.staffActor).toBe(true);
  });

  it("rejects SMTP fields with 400 (strict schema)", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({
      data: { name: "X", slug: uniqueSlug() },
    });

    const { PATCH } = await import("@/app/api/platform/organizations/[orgId]/route");
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "Y",
          smtpHost: "smtp.example.com",
        }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(400);

    // Sanity: l'org n'a pas ete modifiee
    const still = await prisma.organization.findUnique({
      where: { id: org.id },
    });
    expect(still?.name).toBe("X");
  });

  it("rejects reCAPTCHA fields with 400 (strict schema)", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({
      data: { name: "X", slug: uniqueSlug() },
    });

    const { PATCH } = await import("@/app/api/platform/organizations/[orgId]/route");
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "Y",
          recaptchaSecretKey: "secret",
        }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 409 on slug collision", async () => {
    await makeStaff("STAFF_ADMIN");
    const slugA = uniqueSlug("a");
    const slugB = uniqueSlug("b");
    const a = await prisma.organization.create({
      data: { name: "A", slug: slugA },
    });
    await prisma.organization.create({ data: { name: "B", slug: slugB } });

    const { PATCH } = await import("@/app/api/platform/organizations/[orgId]/route");
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${a.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ slug: slugB }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: a.id }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 404 for unknown org", async () => {
    await makeStaff("STAFF_ADMIN");

    const { PATCH } = await import("@/app/api/platform/organizations/[orgId]/route");
    const req = new NextRequest(
      "http://localhost/api/platform/organizations/unknown",
      {
        method: "PATCH",
        body: JSON.stringify({ name: "X" }),
        headers: { "content-type": "application/json" },
      },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ orgId: "unknown" }),
    });
    expect(res.status).toBe(404);
  });
});

// ===========================================================
// POST archive + restore
// ===========================================================

describe("POST /api/platform/organizations/[orgId]/archive", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("sets archived=true + logs ORG_ARCHIVED", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({
      data: { name: "A", slug: uniqueSlug("arch") },
    });

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/archive/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/archive`,
      { method: "POST" },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({
      where: { id: org.id },
    });
    expect(updated?.archived).toBe(true);
    expect(updated?.archivedAt).not.toBeNull();

    const log = await prisma.activityLog.findFirst({
      where: { type: "ORG_ARCHIVED", orgId: org.id },
    });
    expect(log).not.toBeNull();
    expect(log?.staffActor).toBe(true);
  });

  it("STAFF_OBSERVER cannot archive (403)", async () => {
    await makeStaff("STAFF_OBSERVER");
    const org = await prisma.organization.create({
      data: { name: "A", slug: uniqueSlug("arch") },
    });

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/archive/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/archive`,
      { method: "POST" },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/platform/organizations/[orgId]/restore", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("sets archived=false + clears archivedAt + logs ORG_RESTORED", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({
      data: {
        name: "R",
        slug: uniqueSlug("rest"),
        archived: true,
        archivedAt: new Date(),
      },
    });

    const { POST } = await import(
      "@/app/api/platform/organizations/[orgId]/restore/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/restore`,
      { method: "POST" },
    );
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({
      where: { id: org.id },
    });
    expect(updated?.archived).toBe(false);
    expect(updated?.archivedAt).toBeNull();

    const log = await prisma.activityLog.findFirst({
      where: { type: "ORG_RESTORED", orgId: org.id },
    });
    expect(log).not.toBeNull();
  });
});

// ===========================================================
// DELETE /api/platform/organizations/[orgId]
// ===========================================================

describe("DELETE /api/platform/organizations/[orgId]", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("STAFF_ADMIN cannot hard delete (403, SUPER_ADMIN only)", async () => {
    await makeStaff("STAFF_ADMIN");
    const slug = uniqueSlug("del");
    const org = await prisma.organization.create({
      data: { name: "X", slug },
    });

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
      {
        method: "DELETE",
        headers: { "x-confirm": `delete-${slug}` },
      },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(403);

    const still = await prisma.organization.findUnique({
      where: { id: org.id },
    });
    expect(still).not.toBeNull();
  });

  it("SUPER_ADMIN without confirmation returns 400", async () => {
    await makeStaff("SUPER_ADMIN");
    const org = await prisma.organization.create({
      data: { name: "X", slug: uniqueSlug("del") },
    });

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(400);

    const still = await prisma.organization.findUnique({
      where: { id: org.id },
    });
    expect(still).not.toBeNull();
  });

  it("SUPER_ADMIN with correct slug confirm header returns 204 + cascade delete", async () => {
    await makeStaff("SUPER_ADMIN");
    const slug = uniqueSlug("delok");
    const org = await prisma.organization.create({
      data: { name: "Del", slug },
    });
    // Setup children to verify cascade
    const evt = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "E",
        slug: uniqueSlug("ev"),
        location: "L",
        date: new Date(),
      },
    });
    const u = await prisma.user.create({
      data: { email: `mem-${Date.now()}@x`, password: "x", name: "Mem" },
    });
    await prisma.orgMembership.create({
      data: { userId: u.id, orgId: org.id, role: "OWNER" },
    });

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
      {
        method: "DELETE",
        headers: { "x-confirm": `delete-${slug}` },
      },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(204);

    const still = await prisma.organization.findUnique({
      where: { id: org.id },
    });
    expect(still).toBeNull();

    // Cascade verified : event + orgMembership disparus
    const stillEvt = await prisma.event.findUnique({ where: { id: evt.id } });
    expect(stillEvt).toBeNull();
    const stillMem = await prisma.orgMembership.findFirst({
      where: { orgId: org.id },
    });
    expect(stillMem).toBeNull();

    // User non supprime (cascade ne remonte pas a User)
    const stillUser = await prisma.user.findUnique({ where: { id: u.id } });
    expect(stillUser).not.toBeNull();
  });

  it("SUPER_ADMIN with confirmSlug body returns 204", async () => {
    await makeStaff("SUPER_ADMIN");
    const slug = uniqueSlug("delbody");
    const org = await prisma.organization.create({
      data: { name: "Del", slug },
    });

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmSlug: slug }),
      },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(204);
  });

  it("SUPER_ADMIN with wrong confirmation returns 400", async () => {
    await makeStaff("SUPER_ADMIN");
    const slug = uniqueSlug("delwrong");
    const org = await prisma.organization.create({
      data: { name: "Del", slug },
    });

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}`,
      {
        method: "DELETE",
        headers: { "x-confirm": "delete-not-the-slug" },
      },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown org (before confirm check)", async () => {
    await makeStaff("SUPER_ADMIN");

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/route"
    );
    const req = new NextRequest(
      "http://localhost/api/platform/organizations/unknown",
      {
        method: "DELETE",
        headers: { "x-confirm": "delete-anything" },
      },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: "unknown" }),
    });
    expect(res.status).toBe(404);
  });
});
