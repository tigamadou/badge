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

function uniqueSlug(prefix = "u") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

describe("GET /api/platform/users", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 when no session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const { GET } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users");
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-staff", async () => {
    const u = await prisma.user.create({
      data: { email: "client@x", password: "x", name: "Client" },
    });
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users");
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_OBSERVER can read (read-only allowed)", async () => {
    await makeStaff("STAFF_OBSERVER");

    const { GET } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users");
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
  });

  it("lists active users by default and never exposes password", async () => {
    await makeStaff("STAFF_OBSERVER");
    await prisma.user.create({
      data: { email: "c@x", password: "SECRET", name: "Client" },
    });

    const { GET } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    const userEntry = json.users.find((u: { email: string }) => u.email === "c@x");
    expect(userEntry).toBeDefined();
    expect((userEntry as { password?: string }).password).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("SECRET");
  });

  it("filters type=staff", async () => {
    await makeStaff("STAFF_OBSERVER");
    await prisma.user.create({
      data: {
        email: "s2@x",
        password: "x",
        name: "Other Staff",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
      },
    });
    await prisma.user.create({
      data: { email: "c@x", password: "x", name: "Client" },
    });

    const { GET } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users?type=staff");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.users.length).toBeGreaterThan(0);
    expect(json.users.every((u: { isStaff: boolean }) => u.isStaff === true)).toBe(true);
  });

  it("filters type=client", async () => {
    await makeStaff();
    await prisma.user.create({
      data: { email: "c@x", password: "x", name: "Client" },
    });

    const { GET } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users?type=client");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.users.length).toBeGreaterThan(0);
    expect(json.users.every((u: { isStaff: boolean }) => u.isStaff === false)).toBe(true);
  });

  it("filters q on email", async () => {
    await makeStaff();
    await prisma.user.create({
      data: { email: "alice@x", password: "x", name: "Alice" },
    });
    await prisma.user.create({
      data: { email: "bob@x", password: "x", name: "Bob" },
    });

    const { GET } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users?q=alice");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.users.find((u: { email: string }) => u.email === "alice@x")).toBeDefined();
    expect(json.users.find((u: { email: string }) => u.email === "bob@x")).toBeUndefined();
  });

  it("filters q on name", async () => {
    await makeStaff();
    await prisma.user.create({
      data: { email: "u1@x", password: "x", name: "Charlie Brown" },
    });
    await prisma.user.create({
      data: { email: "u2@x", password: "x", name: "David" },
    });

    const { GET } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users?q=Charlie");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.users.find((u: { email: string }) => u.email === "u1@x")).toBeDefined();
    expect(json.users.find((u: { email: string }) => u.email === "u2@x")).toBeUndefined();
  });

  it("returns counts of org memberships per user", async () => {
    await makeStaff("STAFF_OBSERVER");
    const u = await prisma.user.create({
      data: { email: "withorg@x", password: "x", name: "WithOrg" },
    });
    const org = await prisma.organization.create({
      data: { name: "Acme", slug: uniqueSlug("acme") },
    });
    await prisma.orgMembership.create({
      data: { userId: u.id, orgId: org.id, role: "OWNER" },
    });

    const { GET } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users?q=withorg");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    const entry = json.users.find((x: { email: string }) => x.email === "withorg@x");
    expect(entry).toBeDefined();
    expect((entry as { _count: { orgMemberships: number } })._count.orgMemberships).toBe(1);
  });

  it("paginates results with page and pageSize", async () => {
    await makeStaff();
    for (let i = 0; i < 5; i++) {
      await prisma.user.create({
        data: {
          email: `p${i}@x`,
          password: "x",
          name: `Page ${i}`,
        },
      });
    }

    const { GET } = await import("@/app/api/platform/users/route");
    const req = new NextRequest(
      "http://localhost/api/platform/users?type=client&page=1&pageSize=3",
    );
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.users.length).toBe(3);
    expect(json.total).toBe(5);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(3);
  });

  it("filters archived=true", async () => {
    await makeStaff();
    await prisma.user.create({
      data: { email: "a@x", password: "x", name: "Active" },
    });
    await prisma.user.create({
      data: {
        email: "z@x",
        password: "x",
        name: "Archived",
        archived: true,
        archivedAt: new Date(),
      },
    });

    const { GET } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users?archived=true");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(
      json.users.find((u: { email: string }) => u.email === "z@x"),
    ).toBeDefined();
    expect(
      json.users.find((u: { email: string }) => u.email === "a@x"),
    ).toBeUndefined();
  });

  it("archived=all returns both active and archived users (no archived filter)", async () => {
    await makeStaff();
    await prisma.user.create({
      data: { email: "active@x", password: "x", name: "Active" },
    });
    await prisma.user.create({
      data: {
        email: "archived@x",
        password: "x",
        name: "Archived",
        archived: true,
        archivedAt: new Date(),
      },
    });

    const { GET } = await import("@/app/api/platform/users/route");
    const req = new NextRequest("http://localhost/api/platform/users?archived=all");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(
      json.users.find((u: { email: string }) => u.email === "active@x"),
    ).toBeDefined();
    expect(
      json.users.find((u: { email: string }) => u.email === "archived@x"),
    ).toBeDefined();
  });

  it("defaults page/pageSize to 1/20 when query params are not numeric", async () => {
    await makeStaff();
    await prisma.user.create({
      data: { email: "p@x", password: "x", name: "P" },
    });

    const { GET } = await import("@/app/api/platform/users/route");
    const req = new NextRequest(
      "http://localhost/api/platform/users?page=abc&pageSize=xyz",
    );
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(20);
  });
});
