import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PLAN_NAME } from "@/lib/subscription";

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

describe("POST /api/platform/organizations", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 when no session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const { POST } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: "Acme",
        ownerEmail: "owner@acme.com",
        ownerName: "Owner",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("rejects STAFF_OBSERVER with 403", async () => {
    await makeStaff("STAFF_OBSERVER");

    const { POST } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: "Acme",
        ownerEmail: "owner@acme.com",
        ownerName: "Owner",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("rejects STAFF_SUPPORT with 403", async () => {
    await makeStaff("STAFF_SUPPORT");

    const { POST } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: "Acme",
        ownerEmail: "owner@acme.com",
        ownerName: "Owner",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_ADMIN creates org + new OWNER user + membership + invite token", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: "Acme Corp",
        ownerEmail: "owner@acme.com",
        ownerName: "Alice",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.org.slug).toBe("acme-corp");
    expect(json.org.name).toBe("Acme Corp");

    const owner = await prisma.user.findUnique({
      where: { email: "owner@acme.com" },
    });
    expect(owner).not.toBeNull();
    expect(owner?.name).toBe("Alice");
    expect(owner?.password).toBe("");
    expect(owner?.isStaff).toBe(false);
    expect(owner?.inviteToken).not.toBeNull();
    expect(owner?.inviteTokenExpiry).not.toBeNull();

    const membership = await prisma.orgMembership.findFirst({
      where: { userId: owner!.id, orgId: json.org.id },
    });
    expect(membership?.role).toBe("OWNER");

    const logs = await prisma.activityLog.findMany({
      where: { orgId: json.org.id },
      select: { type: true, staffActor: true, targetId: true },
    });
    const types = logs.map((l) => l.type);
    expect(types).toContain("ORG_CREATED");
    expect(types).toContain("USER_CREATED");
    expect(types).toContain("MEMBERSHIP_ADDED");
    for (const log of logs) {
      expect(log.staffActor).toBe(true);
    }
  });

  it("SUPER_ADMIN can also create org", async () => {
    await makeStaff("SUPER_ADMIN");

    const { POST } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: "SuperOrg",
        ownerEmail: "su@x.com",
        ownerName: "Su",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
  });

  it("reuses existing user without creating a new one or new inviteToken", async () => {
    await makeStaff("STAFF_ADMIN");
    const existing = await prisma.user.create({
      data: {
        email: "existing@x.com",
        password: "hashed",
        name: "Existing",
        inviteToken: null,
      },
    });
    expect(existing.inviteToken).toBeNull();

    const { POST } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: "Beta",
        ownerEmail: "existing@x.com",
        ownerName: "Existing",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const users = await prisma.user.findMany({
      where: { email: "existing@x.com" },
    });
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe(existing.id);
    expect(users[0].password).toBe("hashed");
    // No new invite generated for existing user
    expect(users[0].inviteToken).toBeNull();

    // No USER_CREATED log either
    const userCreatedLogs = await prisma.activityLog.findMany({
      where: { type: "USER_CREATED" },
    });
    expect(userCreatedLogs).toHaveLength(0);
  });

  it("generates slug from name and appends -2 on collision", async () => {
    await makeStaff("STAFF_ADMIN");
    await prisma.organization.create({ data: { name: "Acme", slug: "acme" } });

    const { POST } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: "Acme",
        ownerEmail: "o2@x.com",
        ownerName: "O2",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.org.slug).toBe("acme-2");
  });

  it("rejects missing name with 400", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations", {
      method: "POST",
      body: JSON.stringify({
        ownerEmail: "owner@acme.com",
        ownerName: "Owner",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("rejects invalid ownerEmail with 400", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: "Acme",
        ownerEmail: "not-an-email",
        ownerName: "Owner",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when the request body is malformed JSON", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations", {
      method: "POST",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("falls back to slug 'org' when the name has no alphanumeric characters", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: "!!!",
        ownerEmail: "noalnum@x.com",
        ownerName: "Owner",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.org.slug).toBe("org");
  });

  it("falls back to the owner email as name when ownerName is omitted", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: "NoOwnerName",
        ownerEmail: "NoName@x.com",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const owner = await prisma.user.findUnique({
      where: { email: "noname@x.com" },
    });
    expect(owner).not.toBeNull();
    expect(owner?.name).toBe("noname@x.com");
  });

  it("accepts and persists all admin fields", async () => {
    await makeStaff("STAFF_ADMIN");

    const { POST } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: "Full",
        slug: "full-org",
        legalName: "Full SARL",
        addressLine1: "1 rue de la Paix",
        postalCode: "75001",
        city: "Paris",
        country: "FR",
        taxId: "FR123456789",
        website: "https://full.example",
        contactEmail: "contact@full.example",
        contactPhone: "+33123456789",
        ownerEmail: "full-owner@x.com",
        ownerName: "Full Owner",
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    const json = await res.json();
    expect(res.status).toBe(201);

    const org = await prisma.organization.findUnique({
      where: { id: json.org.id },
    });
    expect(org?.legalName).toBe("Full SARL");
    expect(org?.addressLine1).toBe("1 rue de la Paix");
    expect(org?.postalCode).toBe("75001");
    expect(org?.city).toBe("Paris");
    expect(org?.country).toBe("FR");
    expect(org?.taxId).toBe("FR123456789");
    expect(org?.website).toBe("https://full.example");
    expect(org?.contactEmail).toBe("contact@full.example");
    expect(org?.contactPhone).toBe("+33123456789");
  });

  describe("abonnement gratuit par defaut", () => {
    async function createOrg(name: string) {
      const { POST } = await import("@/app/api/platform/organizations/route");
      const res = await POST(
        new NextRequest("http://localhost/api/platform/organizations", {
          method: "POST",
          body: JSON.stringify({ name, ownerEmail: `owner-${Date.now()}@free.test` }),
          headers: { "content-type": "application/json" },
        }),
        { params: Promise.resolve({}) },
      );
      return { res, json: (await res.json()) as { org: { id: string } } };
    }

    it("rattache la nouvelle organisation au plan par defaut, avec une echeance a 30 jours", async () => {
      const staff = await makeStaff("STAFF_ADMIN");
      const plan = await prisma.plan.upsert({
        where: { name: DEFAULT_PLAN_NAME },
        update: { archived: false, period: "MONTHLY" },
        create: { name: DEFAULT_PLAN_NAME, maxEvents: 1, maxParticipantsPerEvent: 100 },
      });

      const { res, json } = await createOrg("Free Corp");
      expect(res.status).toBe(201);

      const sub = await prisma.subscription.findUnique({ where: { orgId: json.org.id } });
      expect(sub?.planId).toBe(plan.id);
      expect(sub?.status).toBe("ACTIVE");
      expect(sub?.overrideMaxEvents).toBeNull();
      expect(sub?.endDate).not.toBeNull();
      expect(Math.round((sub!.endDate!.getTime() - sub!.startDate.getTime()) / 86_400_000)).toBe(30);

      const { resolveOrgLimits } = await import("@/lib/subscription");
      expect((await resolveOrgLimits(json.org.id)).active).toBe(true);

      const log = await prisma.activityLog.findFirst({
        where: { orgId: json.org.id, type: "SUBSCRIPTION_CREATED" },
      });
      expect(log?.userId).toBe(staff.id);
      expect(log?.targetId).toBe(sub?.id);
      expect(log?.details).toMatchObject({ planId: plan.id, status: "ACTIVE", auto: true });
    });

    it("cree l'organisation sans abonnement quand le plan par defaut n'existe pas", async () => {
      await makeStaff("STAFF_ADMIN");
      await prisma.plan.deleteMany({ where: { name: DEFAULT_PLAN_NAME } });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const { res, json } = await createOrg("No Plan Corp");
      expect(res.status).toBe(201);
      expect(await prisma.subscription.findUnique({ where: { orgId: json.org.id } })).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(DEFAULT_PLAN_NAME));
      warn.mockRestore();
    });

    it("ignore un plan par defaut archive", async () => {
      await makeStaff("STAFF_ADMIN");
      await prisma.plan.upsert({
        where: { name: DEFAULT_PLAN_NAME },
        update: { archived: true },
        create: { name: DEFAULT_PLAN_NAME, maxEvents: 1, maxParticipantsPerEvent: 100, archived: true },
      });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      const { res, json } = await createOrg("Archived Plan Corp");
      expect(res.status).toBe(201);
      expect(await prisma.subscription.findUnique({ where: { orgId: json.org.id } })).toBeNull();
      warn.mockRestore();
    });
  });
});
