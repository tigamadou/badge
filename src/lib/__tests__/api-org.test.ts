import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function activatePlan(orgId: string, maxEvents: number | null = null) {
  const plan = await prisma.plan.create({
    data: { name: `p-${orgId}`, maxEvents, maxParticipantsPerEvent: null },
  });
  await prisma.subscription.create({ data: { orgId, planId: plan.id, status: "ACTIVE" } });
}

describe("GET /api/org/[orgId]", () => {
  beforeEach(async () => {
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { GET } = await import("@/app/api/org/[orgId]/route");
    const req = new NextRequest("http://localhost/api/org/whatever", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: "whatever" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller has no role in the org", async () => {
    const u = await prisma.user.create({ data: { email: "outsider-get@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "get-org-403" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}`, { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("returns org details with counts for an AUDITOR", async () => {
    const u = await prisma.user.create({ data: { email: "aud-get@x", password: "x", name: "Aud" } });
    const org = await prisma.organization.create({
      data: { name: "Acme", slug: "get-org-1", legalName: "Acme SAS" },
    });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "AUDITOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}`, { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.org.slug).toBe("get-org-1");
    expect(json.org.legalName).toBe("Acme SAS");
    expect(json.org._count.memberships).toBe(1);
    expect(json.org._count.events).toBe(0);
  });

  it("returns 404 when the org does not exist (staff bypasses the membership check)", async () => {
    const s = await prisma.user.create({
      data: { email: "staff-get-404@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await withSession({ id: s.id, email: s.email, name: s.name, isStaff: true });

    const { GET } = await import("@/app/api/org/[orgId]/route");
    const req = new NextRequest("http://localhost/api/org/does-not-exist", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: "does-not-exist" }) });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/org/[orgId] (Task 4 — name + slug)", () => {
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

    const { PATCH } = await import("@/app/api/org/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}`, {
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

    const { PATCH } = await import("@/app/api/org/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: "new-slug" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(updated?.slug).toBe("new-slug");
  });

  it("returns 400 VALIDATION for a malformed JSON body", async () => {
    const u = await prisma.user.create({ data: { email: "mal@x", password: "x", name: "M" } });
    const org = await prisma.organization.create({ data: { name: "Old", slug: "mal-json" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}`, {
      method: "PATCH",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);
  });

  it("staff renaming the slug to one already taken returns 409 SLUG_TAKEN", async () => {
    const s = await prisma.user.create({
      data: { email: "staff-slug@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    await prisma.organization.create({ data: { name: "Taken", slug: "taken-slug" } });
    const org = await prisma.organization.create({ data: { name: "Old", slug: "free-slug" } });
    await withSession({ id: s.id, email: s.email, name: s.name, isStaff: true });

    const { PATCH } = await import("@/app/api/org/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: "taken-slug" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("SLUG_TAKEN");
  });

  it("ORG_UPDATED log written with staffActor=true for staff", async () => {
    const s = await prisma.user.create({
      data: { email: "s2@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    const org = await prisma.organization.create({ data: { name: "Old", slug: "olda" } });
    await withSession({ id: s.id, email: s.email, name: s.name, isStaff: true });

    const { PATCH } = await import("@/app/api/org/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}`, {
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

  it("rethrows a non-P2002 database error from organization.update", async () => {
    const u = await prisma.user.create({ data: { email: "rethrow-org@x", password: "x", name: "R" } });
    const org = await prisma.organization.create({ data: { name: "Old", slug: "rethrow-org" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const spy = vi.spyOn(prisma.organization, "update").mockRejectedValueOnce(
      Object.assign(new Error("db down"), { code: "P2003" }),
    );

    const { PATCH } = await import("@/app/api/org/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "New" }),
      headers: { "content-type": "application/json" },
    });
    await expect(PATCH(req, { params: Promise.resolve({ orgId: org.id }) })).rejects.toThrow("db down");
    spy.mockRestore();
  });
});

describe("PATCH /api/org/[orgId] — infos administratives (Task 5)", () => {
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

    const { PATCH } = await import("@/app/api/org/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}`, {
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

    const { PATCH } = await import("@/app/api/org/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}`, {
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

    const { PATCH } = await import("@/app/api/org/[orgId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: "owner-attempt" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);

    const after = await prisma.organization.findUnique({ where: { id: org.id } });
    expect(after?.slug).toBe("keep-slug");
  });

  it("rejects legacy SMTP and reCAPTCHA fields with HTTP 400 (defense in depth)", async () => {
    const u = await prisma.user.create({ data: { email: "o4@x", password: "x", name: "O4" } });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "no-secrets" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/route");

    const reqSmtp = new NextRequest(`http://localhost/api/org/${org.id}`, {
      method: "PATCH",
      body: JSON.stringify({ smtpHost: "smtp.example.com", smtpPassword: "secret" }),
      headers: { "content-type": "application/json" },
    });
    const resSmtp = await PATCH(reqSmtp, { params: Promise.resolve({ orgId: org.id }) });
    expect(resSmtp.status).toBe(400);

    const reqCaptcha = new NextRequest(`http://localhost/api/org/${org.id}`, {
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

    const { POST } = await import("@/app/api/org/[orgId]/templates/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/templates`, {
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

    const { POST } = await import("@/app/api/org/[orgId]/templates/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/templates`, {
      method: "POST",
      body: JSON.stringify({ name: "X", color: "red", number: 1 }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);
  });

  it("lists templates ordered by number then name", async () => {
    const u = await prisma.user.create({ data: { email: "tpl-list@x", password: "x", name: "L" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "tpl-list-o" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "AUDITOR" } });
    await prisma.categoryTemplate.create({ data: { orgId: org.id, name: "B", color: "#111111", number: 2 } });
    await prisma.categoryTemplate.create({ data: { orgId: org.id, name: "A", color: "#222222", number: 1 } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/templates/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/templates`, { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.templates.map((t: { number: number }) => t.number)).toEqual([1, 2]);
  });

  it("returns 400 VALIDATION for a malformed JSON body on create", async () => {
    const u = await prisma.user.create({ data: { email: "tpl-bad@x", password: "x", name: "B" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "tpl-bad-json" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/templates/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/templates`, {
      method: "POST",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/org/[orgId]/events", () => {
  beforeEach(async () => {
    await prisma.event.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("lists org events, filterable by archived and registrationOpen", async () => {
    const u = await prisma.user.create({ data: { email: "ge@x", password: "x", name: "GE" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "get-ev-o" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "AUDITOR" } });
    await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Open",
        slug: "get-ev-open",
        location: "",
        date: new Date(),
        registrationOpen: true,
      },
    });
    await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Archived",
        slug: "get-ev-arch",
        location: "",
        date: new Date(),
        archived: true,
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/route");

    const resAll = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/events`, { method: "GET" }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect(resAll.status).toBe(200);
    expect((await resAll.json()).events).toHaveLength(2);

    const resArchived = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/events?archived=true`, { method: "GET" }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    const jsonArchived = await resArchived.json();
    expect(jsonArchived.events).toHaveLength(1);
    expect(jsonArchived.events[0].title).toBe("Archived");

    const resOpen = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/events?registrationOpen=true`, { method: "GET" }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    const jsonOpen = await resOpen.json();
    expect(jsonOpen.events).toHaveLength(1);
    expect(jsonOpen.events[0].title).toBe("Open");
  });
});

describe("POST /api/org/[orgId]/events", () => {
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
    await activatePlan(org.id);
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events`, {
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

  it("accepte une description et une date de fin", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ev-desc" } });
    await activatePlan(org.id);
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({
        title: "Salon 2026",
        location: "Niamey",
        date: "2026-12-15",
        endDate: "2026-12-17",
        description: "Trois jours de conferences.",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(201);
    const event = await prisma.event.findFirst({ where: { orgId: org.id } });
    expect(event?.description).toBe("Trois jours de conferences.");
    expect(event?.endDate?.toISOString().slice(0, 10)).toBe("2026-12-17");
  });

  it("refuse une date de fin anterieure a la date de debut", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ev-badend" } });
    await activatePlan(org.id);
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({
        title: "Salon 2026",
        location: "Niamey",
        date: "2026-12-15",
        endDate: "2026-12-14",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("VALIDATION");
  });

  it("appends -2 if global slug collision", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const orgA = await prisma.organization.create({ data: { name: "A", slug: "a-o" } });
    const orgB = await prisma.organization.create({ data: { name: "B", slug: "b-o" } });
    await activatePlan(orgB.id);
    await prisma.event.create({
      data: { orgId: orgA.id, title: "X", slug: "x", location: "", date: new Date() },
    });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: orgB.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${orgB.id}/events`, {
      method: "POST",
      body: JSON.stringify({ title: "X", location: "", date: "2026-12-15" }),
      headers: { "content-type": "application/json" },
    });
    await POST(req, { params: Promise.resolve({ orgId: orgB.id }) });
    const event = await prisma.event.findFirst({ where: { orgId: orgB.id } });
    expect(event?.slug).toBe("x-2");
  });

  it("refuses creation when the plan event limit is reached (409 EVENT_LIMIT)", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({
      data: { name: "O", slug: "q-o" },
    });
    await activatePlan(org.id, 1);
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

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({ title: "Second", location: "", date: "2026-12-15" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("EVENT_LIMIT");
  });

  it("copies CategoryTemplate to Category when templateIds provided", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "tpl-ev-o" } });
    await activatePlan(org.id);
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    const tpl = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "Délégué", color: "#ff0000", number: 1 },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events`, {
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

  it("returns 400 VALIDATION for a malformed JSON body", async () => {
    const u = await prisma.user.create({ data: { email: "malev@x", password: "x", name: "M" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ev-bad-json" } });
    await activatePlan(org.id);
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events`, {
      method: "POST",
      body: "{bad json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(400);
  });

  it("staff bypasses the event quota (limit reached) and logs QUOTA_BYPASS", async () => {
    const s = await prisma.user.create({
      data: { email: "staff-quota@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ev-quota-bypass" } });
    await activatePlan(org.id, 1);
    await prisma.event.create({
      data: { orgId: org.id, title: "Existing", slug: "existing-qb", location: "", date: new Date() },
    });
    await withSession({ id: s.id, email: s.email, name: s.name, isStaff: true });

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({ title: "Bypass", location: "", date: "2026-12-15" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(201);

    const log = await prisma.activityLog.findFirst({
      where: { type: "QUOTA_BYPASS", orgId: org.id },
    });
    expect(log).not.toBeNull();
    expect((log?.details as { code?: string })?.code).toBe("EVENT_LIMIT");
  });

  it("creates categories from manualCategories", async () => {
    const u = await prisma.user.create({ data: { email: "manual@x", password: "x", name: "M" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ev-manual-cat" } });
    await activatePlan(org.id);
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({
        title: "Manual",
        location: "",
        date: "2026-12-15",
        manualCategories: [{ name: "VIP", color: "#000000", number: 1 }],
      }),
      headers: { "content-type": "application/json" },
    });
    await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    const cats = await prisma.category.findMany();
    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe("VIP");
  });

  it("renumbers a manual category colliding with a template's number", async () => {
    const u = await prisma.user.create({ data: { email: "renum@x", password: "x", name: "R" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ev-renumber" } });
    await activatePlan(org.id);
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    const tpl = await prisma.categoryTemplate.create({
      data: { orgId: org.id, name: "Délégué", color: "#ff0000", number: 1 },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({
        title: "Renumber",
        location: "",
        date: "2026-12-15",
        templateIds: [tpl.id],
        manualCategories: [{ name: "Presse", color: "#00ff00", number: 1 }],
      }),
      headers: { "content-type": "application/json" },
    });
    await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    const cats = await prisma.category.findMany({ orderBy: { number: "asc" } });
    expect(cats).toHaveLength(2);
    expect(cats.map((c) => c.number)).toEqual([1, 2]);
  });

  it("returns 409 SLUG_TAKEN when an explicit slug collides", async () => {
    const u = await prisma.user.create({ data: { email: "slugtaken@x", password: "x", name: "S" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ev-slug-taken-org" } });
    await activatePlan(org.id);
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await prisma.event.create({
      data: { orgId: org.id, title: "Existing", slug: "already-used", location: "", date: new Date() },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({ title: "New", location: "", date: "2026-12-15", slug: "already-used" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("SLUG_TAKEN");
  });

  it("rethrows a non-SubscriptionError from assertCanCreateEvent", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ev-subscription-rethrow" } });
    await activatePlan(org.id);
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const spy = vi.spyOn(prisma.subscription, "findUnique").mockRejectedValueOnce(new Error("db boom"));

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({ title: "X", location: "", date: "2026-12-15" }),
      headers: { "content-type": "application/json" },
    });
    await expect(POST(req, { params: Promise.resolve({ orgId: org.id }) })).rejects.toThrow("db boom");
    spy.mockRestore();
  });

  it("rethrows a P2002 conflict on event.create whose target is not the slug", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ev-p2002-other" } });
    await activatePlan(org.id);
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const spy = vi.spyOn(prisma.event, "create").mockRejectedValueOnce(
      Object.assign(new Error("db"), { code: "P2002", meta: { target: "Event_other_key" } }),
    );

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({ title: "X", location: "", date: "2026-12-15" }),
      headers: { "content-type": "application/json" },
    });
    await expect(POST(req, { params: Promise.resolve({ orgId: org.id }) })).rejects.toThrow("db");
    spy.mockRestore();
  });

  it("returns 409 SLUG_TAKEN when event.create fails with a P2002 array target containing slug", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "ev-p2002-array" } });
    await activatePlan(org.id);
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const spy = vi.spyOn(prisma.event, "create").mockRejectedValueOnce(
      Object.assign(new Error("dup"), { code: "P2002", meta: { target: ["slug"] } }),
    );

    const { POST } = await import("@/app/api/org/[orgId]/events/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events`, {
      method: "POST",
      body: JSON.stringify({ title: "X", location: "", date: "2026-12-15" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("SLUG_TAKEN");
    spy.mockRestore();
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

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/archive/route");
    const req = new NextRequest(
      `http://localhost/api/org/${org.id}/events/${e.id}/archive`,
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

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/archive/route");
    const req = new NextRequest(
      `http://localhost/api/org/${orgA.id}/events/${e.id}/archive`,
      { method: "POST" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ orgId: orgA.id, eventId: e.id }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/archive/route");
    const req = new NextRequest("http://localhost/api/org/x/events/y/archive", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ orgId: "x", eventId: "y" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for AUDITOR (below MANAGER)", async () => {
    const u = await prisma.user.create({ data: { email: "aud-arch@x", password: "x", name: "Aud" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "arch-403" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "AUDITOR" } });
    const e = await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: "arch-403-e", location: "", date: new Date() },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/archive/route");
    const req = new NextRequest(
      `http://localhost/api/org/${org.id}/events/${e.id}/archive`,
      { method: "POST" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ orgId: org.id, eventId: e.id }),
    });
    expect(res.status).toBe(403);
  });

  it("rethrows a non-AuthError from requireOrgRole", async () => {
    const u = await prisma.user.create({ data: { email: "arch-rethrow@x", password: "x", name: "R" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "arch-rethrow" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    const e = await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: "arch-rethrow-e", location: "", date: new Date() },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const spy = vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("db boom"));

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/archive/route");
    const req = new NextRequest(
      `http://localhost/api/org/${org.id}/events/${e.id}/archive`,
      { method: "POST" },
    );
    await expect(
      POST(req, { params: Promise.resolve({ orgId: org.id, eventId: e.id }) }),
    ).rejects.toThrow("db boom");
    spy.mockRestore();
  });
});
