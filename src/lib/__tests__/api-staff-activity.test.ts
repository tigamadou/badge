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

async function makeStaff(staffRole: StaffRoleStr = "STAFF_OBSERVER") {
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

function uniqueSlug(prefix = "act") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

describe("GET /api/platform/activity", () => {
  beforeEach(async () => {
    await cleanDb();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { GET } = await import("@/app/api/platform/activity/route");
    const req = new NextRequest("http://localhost/api/platform/activity");
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-staff", async () => {
    const u = await prisma.user.create({
      data: { email: "c@x", password: "x", name: "C" },
    });
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { GET } = await import("@/app/api/platform/activity/route");
    const req = new NextRequest("http://localhost/api/platform/activity");
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("STAFF_OBSERVER can list (read-only allowed) and orders desc by createdAt", async () => {
    await makeStaff("STAFF_OBSERVER");
    const u = await prisma.user.create({
      data: { email: `u-${Date.now()}@x`, password: "x", name: "U" },
    });
    // Trois entries avec createdAt explicites espaces.
    const t1 = new Date("2025-01-01T10:00:00Z");
    const t2 = new Date("2025-01-02T10:00:00Z");
    const t3 = new Date("2025-01-03T10:00:00Z");
    await prisma.activityLog.create({
      data: { type: "USER_CREATED", userId: u.id, createdAt: t1 },
    });
    await prisma.activityLog.create({
      data: { type: "USER_LOGIN", userId: u.id, createdAt: t2 },
    });
    await prisma.activityLog.create({
      data: { type: "USER_UPDATED", userId: u.id, createdAt: t3 },
    });

    const { GET } = await import("@/app/api/platform/activity/route");
    const req = new NextRequest("http://localhost/api/platform/activity");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.activities.length).toBe(3);
    expect(json.activities[0].type).toBe("USER_UPDATED");
    expect(json.activities[1].type).toBe("USER_LOGIN");
    expect(json.activities[2].type).toBe("USER_CREATED");
    expect(json.total).toBe(3);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(50);
  });

  it("includes related user (id, email, name) in each entry", async () => {
    await makeStaff("STAFF_OBSERVER");
    const u = await prisma.user.create({
      data: { email: `actor-${Date.now()}@x`, password: "x", name: "Actor" },
    });
    await prisma.activityLog.create({
      data: { type: "USER_LOGIN", userId: u.id },
    });

    const { GET } = await import("@/app/api/platform/activity/route");
    const req = new NextRequest("http://localhost/api/platform/activity");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.activities[0].user.email).toBe(u.email);
    expect(json.activities[0].user.name).toBe("Actor");
    expect(json.activities[0].user.id).toBe(u.id);
  });

  it("filters by type", async () => {
    await makeStaff();
    const u = await prisma.user.create({
      data: { email: `f-${Date.now()}@x`, password: "x", name: "F" },
    });
    await prisma.activityLog.create({ data: { type: "USER_CREATED", userId: u.id } });
    await prisma.activityLog.create({ data: { type: "USER_LOGIN", userId: u.id } });
    await prisma.activityLog.create({ data: { type: "USER_LOGIN", userId: u.id } });

    const { GET } = await import("@/app/api/platform/activity/route");
    const req = new NextRequest(
      "http://localhost/api/platform/activity?type=USER_LOGIN",
    );
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.activities.length).toBe(2);
    expect(
      json.activities.every((a: { type: string }) => a.type === "USER_LOGIN"),
    ).toBe(true);
    expect(json.total).toBe(2);
  });

  it("filters by orgId", async () => {
    await makeStaff();
    const u = await prisma.user.create({
      data: { email: `o-${Date.now()}@x`, password: "x", name: "U" },
    });
    const orgA = await prisma.organization.create({
      data: { name: "A", slug: uniqueSlug("a") },
    });
    const orgB = await prisma.organization.create({
      data: { name: "B", slug: uniqueSlug("b") },
    });
    await prisma.activityLog.create({
      data: { type: "ORG_UPDATED", userId: u.id, orgId: orgA.id },
    });
    await prisma.activityLog.create({
      data: { type: "ORG_UPDATED", userId: u.id, orgId: orgB.id },
    });

    const { GET } = await import("@/app/api/platform/activity/route");
    const req = new NextRequest(
      `http://localhost/api/platform/activity?orgId=${orgA.id}`,
    );
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.activities.length).toBe(1);
    expect(json.activities[0].orgId).toBe(orgA.id);
  });

  it("filters by userId", async () => {
    await makeStaff();
    const u1 = await prisma.user.create({
      data: { email: `u1-${Date.now()}@x`, password: "x", name: "U1" },
    });
    const u2 = await prisma.user.create({
      data: { email: `u2-${Date.now()}@x`, password: "x", name: "U2" },
    });
    await prisma.activityLog.create({ data: { type: "USER_LOGIN", userId: u1.id } });
    await prisma.activityLog.create({ data: { type: "USER_LOGIN", userId: u2.id } });

    const { GET } = await import("@/app/api/platform/activity/route");
    const req = new NextRequest(
      `http://localhost/api/platform/activity?userId=${u1.id}`,
    );
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.activities.length).toBe(1);
    expect(json.activities[0].userId).toBe(u1.id);
  });

  it("filters by staffActor=true", async () => {
    await makeStaff();
    const staffUser = await prisma.user.create({
      data: {
        email: `actor-${Date.now()}@x`,
        password: "x",
        name: "Actor",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
      },
    });
    const org = await prisma.organization.create({
      data: { name: "O", slug: uniqueSlug("o") },
    });
    await prisma.activityLog.create({
      data: {
        type: "ORG_UPDATED",
        userId: staffUser.id,
        orgId: org.id,
        staffActor: true,
      },
    });
    await prisma.activityLog.create({
      data: {
        type: "USER_LOGIN",
        userId: staffUser.id,
        staffActor: false,
      },
    });

    const { GET } = await import("@/app/api/platform/activity/route");
    const req = new NextRequest(
      "http://localhost/api/platform/activity?staffActor=true",
    );
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.activities.length).toBe(1);
    expect(json.activities[0].staffActor).toBe(true);
  });

  it("filters by staffActor=false", async () => {
    await makeStaff();
    const u = await prisma.user.create({
      data: { email: `n-${Date.now()}@x`, password: "x", name: "N" },
    });
    await prisma.activityLog.create({
      data: { type: "USER_LOGIN", userId: u.id, staffActor: false },
    });
    await prisma.activityLog.create({
      data: { type: "USER_LOGIN", userId: u.id, staffActor: true },
    });

    const { GET } = await import("@/app/api/platform/activity/route");
    const req = new NextRequest(
      "http://localhost/api/platform/activity?staffActor=false",
    );
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.activities.length).toBe(1);
    expect(json.activities[0].staffActor).toBe(false);
  });

  it("filters by from/to date range (inclusive)", async () => {
    await makeStaff();
    const u = await prisma.user.create({
      data: { email: `d-${Date.now()}@x`, password: "x", name: "D" },
    });
    const t1 = new Date("2025-01-01T00:00:00Z");
    const t2 = new Date("2025-06-15T00:00:00Z");
    const t3 = new Date("2025-12-31T00:00:00Z");
    await prisma.activityLog.create({
      data: { type: "USER_LOGIN", userId: u.id, createdAt: t1 },
    });
    await prisma.activityLog.create({
      data: { type: "USER_LOGIN", userId: u.id, createdAt: t2 },
    });
    await prisma.activityLog.create({
      data: { type: "USER_LOGIN", userId: u.id, createdAt: t3 },
    });

    const { GET } = await import("@/app/api/platform/activity/route");
    const req = new NextRequest(
      "http://localhost/api/platform/activity?from=2025-06-01T00:00:00Z&to=2025-07-01T00:00:00Z",
    );
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.activities.length).toBe(1);
    expect(new Date(json.activities[0].createdAt).toISOString()).toBe(
      t2.toISOString(),
    );
  });

  it("paginates with page + pageSize, exposes total", async () => {
    await makeStaff();
    const u = await prisma.user.create({
      data: { email: `p-${Date.now()}@x`, password: "x", name: "P" },
    });
    // 5 entries.
    for (let i = 0; i < 5; i++) {
      await prisma.activityLog.create({
        data: {
          type: "USER_LOGIN",
          userId: u.id,
          createdAt: new Date(2025, 0, i + 1),
        },
      });
    }

    const { GET } = await import("@/app/api/platform/activity/route");
    const req1 = new NextRequest(
      "http://localhost/api/platform/activity?page=1&pageSize=2",
    );
    const res1 = await GET(req1, { params: Promise.resolve({}) });
    const j1 = await res1.json();
    expect(j1.activities.length).toBe(2);
    expect(j1.total).toBe(5);
    expect(j1.page).toBe(1);
    expect(j1.pageSize).toBe(2);

    const req2 = new NextRequest(
      "http://localhost/api/platform/activity?page=3&pageSize=2",
    );
    const res2 = await GET(req2, { params: Promise.resolve({}) });
    const j2 = await res2.json();
    expect(j2.activities.length).toBe(1);
    expect(j2.total).toBe(5);
    expect(j2.page).toBe(3);
  });
});
