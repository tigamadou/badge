import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

describe("PATCH /api/admin/[orgId] (Task 4 — name + slug)", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("OWNER can update name but not slug", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "Old", slug: "old" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New", slug: "new-slug" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.name).toBe("New");
    expect(updated?.slug).toBe("old");
  });

  it("staff can update slug", async () => {
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_SUPPORT" },
    });
    const org = await prisma.organization.create({ data: { name: "Old", slug: "old" } });
    await withSession({ id: s.id, email: s.email, name: s.name, isStaff: true });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: "new-slug" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.slug).toBe("new-slug");
  });

  it("ORG_UPDATED log written with staffActor=true for staff", async () => {
    const s = await prisma.user.create({
      data: { email: "s2@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    const org = await prisma.organization.create({ data: { name: "Old", slug: "olda" } });
    await withSession({ id: s.id, email: s.email, name: s.name, isStaff: true });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "content-type": "application/json" },
    });
    await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });

    const log = await prisma.activityLog.findFirst({
      where: { type: "ORG_UPDATED", orgId: org.id },
    });
    expect(log?.staffActor).toBe(true);
  });
});

describe("PATCH /api/admin/[orgId] — infos administratives (Task 5)", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("OWNER updates legalName, address, taxId, website, logo, contact", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "acme-admin" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        legalName: "Acme SAS",
        addressLine1: "1 rue de Paris",
        addressLine2: "Bat. A",
        postalCode: "75001",
        city: "Paris",
        country: "FR",
        taxId: "FR12345678901",
        website: "https://acme.example",
        logo: "/uploads/acme.png",
        contactEmail: "contact@acme.example",
        contactPhone: "+33123456789",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.legalName).toBe("Acme SAS");
    expect(updated?.addressLine1).toBe("1 rue de Paris");
    expect(updated?.addressLine2).toBe("Bat. A");
    expect(updated?.postalCode).toBe("75001");
    expect(updated?.city).toBe("Paris");
    expect(updated?.country).toBe("FR");
    expect(updated?.taxId).toBe("FR12345678901");
    expect(updated?.website).toBe("https://acme.example");
    expect(updated?.logo).toBe("/uploads/acme.png");
    expect(updated?.contactEmail).toBe("contact@acme.example");
    expect(updated?.contactPhone).toBe("+33123456789");

    const log = await prisma.activityLog.findFirst({
      where: { type: "ORG_UPDATED", orgId: org.id },
    });
    expect(log).toBeTruthy();
    expect(log?.staffActor).toBe(false);
  });

  it("MANAGER (non-OWNER membership) is refused with HTTP 403", async () => {
    const u = await prisma.user.create({ data: { email: "m@x", password: "x", name: "M" } });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "acme-mgr" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ legalName: "Acme SAS" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("OWNER cannot edit slug (silently ignored, only staff can)", async () => {
    const u = await prisma.user.create({ data: { email: "o2@x", password: "x", name: "O2" } });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "keep-slug" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: "owner-attempt" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);

    const after = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(after?.slug).toBe("keep-slug");
  });

  it("OWNER cannot edit quotaMaxEvents (silently ignored, only staff can)", async () => {
    const u = await prisma.user.create({ data: { email: "o3@x", password: "x", name: "O3" } });
    const org = await prisma.organization.create({
      data: { name: "Acme", slug: "keep-quota", quotaMaxEvents: 5 },
    });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ quotaMaxEvents: 999 }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);

    const after = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(after?.quotaMaxEvents).toBe(5);
  });

  it("rejects legacy SMTP and reCAPTCHA fields with HTTP 400 (defense in depth)", async () => {
    const u = await prisma.user.create({ data: { email: "o4@x", password: "x", name: "O4" } });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "no-secrets" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/admin/[orgId]/route");

    const reqSmtp = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ smtpHost: "smtp.example.com", smtpPassword: "secret" }),
      headers: { "content-type": "application/json" },
    });
    const resSmtp = await PATCH(reqSmtp, { params: Promise.resolve({ orgId: org.id }) });
    expect(resSmtp.status).toBe(400);

    const reqCaptcha = new NextRequest(`http://localhost/api/admin/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        recaptchaEnabled: true,
        recaptchaSiteKey: "sk",
        recaptchaSecretKey: "secret",
      }),
      headers: { "content-type": "application/json" },
    });
    const resCaptcha = await PATCH(reqCaptcha, { params: Promise.resolve({ orgId: org.id }) });
    expect(resCaptcha.status).toBe(400);
  });
});

describe("POST /api/admin/[orgId]/members", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("creates user + membership if user does not exist", async () => {
    const inviter = await prisma.user.create({ data: { email: "i@x", password: "x", name: "I" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "m-o" } });
    await prisma.orgMembership.create({
      data: { userId: inviter.id, orgId: org.id, role: "OWNER" },
    });
    await withSession({
      id: inviter.id,
      email: inviter.email,
      name: inviter.name,
      isStaff: false,
    });

    const { POST } = await import("@/app/api/admin/[orgId]/members/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "new@test.fr", name: "New" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(201);

    const u = await prisma.user.findUnique({ where: { email: "new@test.fr" } });
    expect(u).not.toBeNull();
    expect(u?.inviteToken).not.toBeNull();
    const m = await prisma.orgMembership.findFirst({ where: { userId: u!.id, orgId: org.id } });
    expect(m?.role).toBe("OWNER");
  });

  it("adds membership only if user already exists", async () => {
    const inviter = await prisma.user.create({ data: { email: "i@x", password: "x", name: "I" } });
    const existing = await prisma.user.create({
      data: { email: "existing@test.fr", password: "x", name: "E" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "m-o2" } });
    await prisma.orgMembership.create({
      data: { userId: inviter.id, orgId: org.id, role: "OWNER" },
    });
    await withSession({
      id: inviter.id,
      email: inviter.email,
      name: inviter.name,
      isStaff: false,
    });

    const { POST } = await import("@/app/api/admin/[orgId]/members/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email: "existing@test.fr", name: "E" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(201);

    const u = await prisma.user.findUnique({ where: { id: existing.id } });
    expect(u?.inviteToken).toBeNull();
  });
});

describe("DELETE /api/admin/[orgId]/members/[userId]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("refuses to remove the last OWNER (409 LAST_OWNER)", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "del-o" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { DELETE } = await import("@/app/api/admin/[orgId]/members/[userId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/members/${u.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ orgId: org.id, userId: u.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("LAST_OWNER");
  });

  it("allows removing one OWNER when 2+ exist", async () => {
    const a = await prisma.user.create({ data: { email: "a@x", password: "x", name: "A" } });
    const b = await prisma.user.create({ data: { email: "b@x", password: "x", name: "B" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "del-o2" } });
    await prisma.orgMembership.create({ data: { userId: a.id, orgId: org.id, role: "OWNER" } });
    await prisma.orgMembership.create({ data: { userId: b.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: a.id, email: a.email, name: a.name, isStaff: false });

    const { DELETE } = await import("@/app/api/admin/[orgId]/members/[userId]/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/members/${b.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ orgId: org.id, userId: b.id }) });
    expect(res.status).toBe(204);
  });
});

describe("Templates CRUD", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.categoryTemplate.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("creates template and writes audit", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "tpl-o" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/templates/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/templates`, {
      method: "POST",
      body: JSON.stringify({ name: "Délégué", color: "#ff0000", number: 1 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(201);

    const tpl = await prisma.categoryTemplate.findFirst({ where: { orgId: org.id } });
    expect(tpl?.name).toBe("Délégué");
    const log = await prisma.activityLog.findFirst({
      where: { type: "CATEGORY_TEMPLATE_CREATED" },
    });
    expect(log?.orgId).toBe(org.id);
  });

  it("rejects invalid color", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "tpl-o2" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/templates/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/templates`, {
      method: "POST",
      body: JSON.stringify({ name: "X", color: "red", number: 1 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/[orgId]/events", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.category.deleteMany();
    await prisma.event.deleteMany();
    await prisma.categoryTemplate.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("creates event with unique slug and registrationOpen=false", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ev-o" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({
        title: "Conférence Paris 2026",
        location: "Paris",
        date: "2026-12-15",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(201);

    const event = await prisma.event.findFirst({ where: { orgId: org.id } });
    expect(event?.slug).toBe("conference-paris-2026");
    expect(event?.registrationOpen).toBe(false);
  });

  it("appends -2 if global slug collision", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const orgA = await prisma.organization.create({ data: { name: "A", slug: "a-o" } });
    const orgB = await prisma.organization.create({ data: { name: "B", slug: "b-o" } });
    await prisma.event.create({
      data: { orgId: orgA.id, title: "X", slug: "x", location: "", date: new Date() },
    });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: orgB.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/admin/${orgB.id}/events`, {
      method: "POST",
      body: JSON.stringify({ title: "X", location: "", date: "2026-12-15" }),
      headers: { "content-type": "application/json" },
    });
    await POST(req, { params: Promise.resolve({ orgId: orgB.id }) });
    const event = await prisma.event.findFirst({ where: { orgId: orgB.id } });
    expect(event?.slug).toBe("x-2");
  });

  it("refuses creation when quotaMaxEvents is reached (409 QUOTA_EXCEEDED)", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({
      data: { name: "O", slug: "q-o", quotaMaxEvents: 1 },
    });
    await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Existing",
        slug: "existing",
        location: "",
        date: new Date(),
      },
    });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({ title: "Second", location: "", date: "2026-12-15" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("QUOTA_EXCEEDED");
  });

  it("copies CategoryTemplate to Category when templateIds provided", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "tpl-ev-o" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    const tpl = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "Délégué", color: "#ff0000", number: 1 },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/admin/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({
        title: "Conf Tpl",
        location: "Paris",
        date: "2026-12-15",
        templateIds: [tpl.id],
      }),
      headers: { "content-type": "application/json" },
    });
    await POST(req, { params: Promise.resolve({ orgId: org.id }) });

    const cats = await prisma.category.findMany();
    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe("Délégué");
    expect(cats[0].color).toBe("#ff0000");
  });
});

describe("Archive/Restore events", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.event.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("archives an event of the org", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ar-o" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    const e = await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: "ar-e", location: "", date: new Date() },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/archive/route");
    const req = new NextRequest(
      `http://localhost/api/admin/${org.id}/events/${e.id}/archive`,
      { method: "POST" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ orgId: org.id, eventId: e.id }),
    });
    expect(res.status).toBe(200);
    const updated = await prisma.event.findUnique({ where: { id: e.id } });
    expect(updated?.archived).toBe(true);
  });

  it("refuses to archive event of another org (404)", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const orgA = await prisma.organization.create({ data: { name: "A", slug: "x-a" } });
    const orgB = await prisma.organization.create({ data: { name: "B", slug: "x-b" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: orgA.id, role: "OWNER" } });
    const e = await prisma.event.create({
      data: { orgId: orgB.id, title: "T", slug: "x-e", location: "", date: new Date() },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/archive/route");
    const req = new NextRequest(
      `http://localhost/api/admin/${orgA.id}/events/${e.id}/archive`,
      { method: "POST" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ orgId: orgA.id, eventId: e.id }),
    });
    expect(res.status).toBe(404);
  });
});
