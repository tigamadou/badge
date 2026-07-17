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
        quotaMaxEvents: 100,
        quotaMaxRegistrations: 5000,
        quotaMaxStorageMB: 2048,
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
    expect(org?.quotaMaxEvents).toBe(100);
    expect(org?.quotaMaxRegistrations).toBe(5000);
    expect(org?.quotaMaxStorageMB).toBe(2048);
  });
});
