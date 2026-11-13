import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";
import { makeStaff as createStaff } from "@/test/factories";

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function makeStaff(staffRole: StaffRoleStr = "STAFF_ADMIN") {
  const u = await createStaff(staffRole);
  withSession({ id: u.id, email: u.email, name: u.name, isStaff: true });
  return u;
}

describe("GET /api/platform/organizations", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("lists active organizations by default", async () => {
    await makeStaff("STAFF_OBSERVER");
    await prisma.organization.create({ data: { name: "Active", slug: "active" } });
    await prisma.organization.create({
      data: { name: "Archived", slug: "arch", archived: true, archivedAt: new Date() },
    });

    const { GET } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.organizations).toHaveLength(1);
    expect(json.organizations[0].slug).toBe("active");
    expect(json.total).toBe(1);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(10);
  });

  it("filters by archived=true", async () => {
    await makeStaff("STAFF_OBSERVER");
    await prisma.organization.create({ data: { name: "Active", slug: "active" } });
    await prisma.organization.create({
      data: { name: "Archived", slug: "arch", archived: true, archivedAt: new Date() },
    });

    const { GET } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations?archived=true");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.organizations).toHaveLength(1);
    expect(json.organizations[0].slug).toBe("arch");
  });

  it("filters by q on name", async () => {
    await makeStaff();
    await prisma.organization.create({ data: { name: "Acme Corp", slug: "acme" } });
    await prisma.organization.create({ data: { name: "Other Inc", slug: "other" } });

    const { GET } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations?q=Acme");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.organizations).toHaveLength(1);
    expect(json.organizations[0].slug).toBe("acme");
  });

  it("filters by q on slug", async () => {
    await makeStaff();
    await prisma.organization.create({ data: { name: "Acme Corp", slug: "acme" } });
    await prisma.organization.create({ data: { name: "Other Inc", slug: "other" } });

    const { GET } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations?q=other");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.organizations).toHaveLength(1);
    expect(json.organizations[0].slug).toBe("other");
  });

  it("paginates results with page and pageSize", async () => {
    await makeStaff();
    for (let i = 0; i < 15; i++) {
      await prisma.organization.create({
        data: { name: `Org ${i.toString().padStart(2, "0")}`, slug: `org-${i}` },
      });
    }

    const { GET } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest(
      "http://localhost/api/platform/organizations?page=2&pageSize=10",
    );
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.organizations).toHaveLength(5);
    expect(json.total).toBe(15);
    expect(json.page).toBe(2);
    expect(json.pageSize).toBe(10);
    // Tri par nom asc : la page 2 de taille 10 commence a "Org 10"
    expect(json.organizations[0].slug).toBe("org-10");
    expect(json.organizations[4].slug).toBe("org-14");
  });

  it("returns counts of events and memberships per organization", async () => {
    const staff = await makeStaff();
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "acme" } });
    await prisma.event.create({
      data: { orgId: org.id, title: "E1", slug: "e1", location: "L", date: new Date() },
    });
    await prisma.event.create({
      data: { orgId: org.id, title: "E2", slug: "e2", location: "L", date: new Date() },
    });
    const memberUser = await prisma.user.create({
      data: { email: "m@x", password: "x", name: "M" },
    });
    await prisma.orgMembership.create({
      data: { userId: memberUser.id, orgId: org.id, role: "OWNER" },
    });
    // Re-arm session (the membership user creation does not change session)
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    const { GET } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations");
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(json.organizations).toHaveLength(1);
    expect(json.organizations[0]._count).toEqual({ events: 2, memberships: 1 });
  });

  it("rejects non-staff with 403", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations");
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const { GET } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations");
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("allows SUPER_ADMIN (highest staff role)", async () => {
    await makeStaff("SUPER_ADMIN");
    await prisma.organization.create({ data: { name: "Active", slug: "active" } });

    const { GET } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest("http://localhost/api/platform/organizations");
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
  });

  it("falls back to default page/pageSize when the query params are not numeric", async () => {
    await makeStaff();
    await prisma.organization.create({ data: { name: "Active", slug: "active" } });

    const { GET } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest(
      "http://localhost/api/platform/organizations?page=abc&pageSize=xyz",
    );
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(10);
  });

  it("accepte 500, ramene une taille hors liste ou negative au defaut", async () => {
    await makeStaff();
    await prisma.organization.create({ data: { name: "Active", slug: "active" } });

    const { GET } = await import("@/app/api/platform/organizations/route");
    const req = new NextRequest(
      "http://localhost/api/platform/organizations?page=0&pageSize=-5",
    );
    const res = await GET(req, { params: Promise.resolve({}) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(10);

    const big = await GET(new NextRequest("http://localhost/api/platform/organizations?pageSize=500"), {
      params: Promise.resolve({}),
    });
    expect((await big.json()).pageSize).toBe(500);
    const odd = await GET(new NextRequest("http://localhost/api/platform/organizations?pageSize=7"), {
      params: Promise.resolve({}),
    });
    expect((await odd.json()).pageSize).toBe(10);
  });
});
