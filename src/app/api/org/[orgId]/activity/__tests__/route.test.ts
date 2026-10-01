import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function seedOrgWithMember(role: "OWNER" | "MANAGER" | "AUDITOR" = "AUDITOR") {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await prisma.user.create({ data: { email: `a-${stamp}@x.test`, password: "x", name: "A" } });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp}` } });
  await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role } });
  withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
  return { u, org };
}

describe("GET /api/org/[orgId]/activity", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.event.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { GET } = await import("@/app/api/org/[orgId]/activity/route");
    const req = new NextRequest("http://localhost/api/org/whatever/activity", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: "whatever" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller has no role in the org", async () => {
    const u = await prisma.user.create({ data: { email: "outsider-act@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "act-403" } });
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/activity/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/activity`, { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("lists activity logs for the org, most recent first, with user info", async () => {
    const { u, org } = await seedOrgWithMember("AUDITOR");
    await prisma.activityLog.create({
      data: { type: "ORG_UPDATED", orgId: org.id, userId: u.id, details: { a: 1 } },
    });
    await new Promise((r) => setTimeout(r, 5));
    await prisma.activityLog.create({
      data: { type: "ORG_UPDATED", orgId: org.id, userId: u.id, details: { a: 2 } },
    });

    const { GET } = await import("@/app/api/org/[orgId]/activity/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/activity`, { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(2);
    expect((json.items[0].details as { a: number }).a).toBe(2);
    expect(json.items[0].user.id).toBe(u.id);
    expect(json.nextCursor).toBeNull();
  });

  it("supports filtering by type, eventId, userId and date range", async () => {
    const { u, org } = await seedOrgWithMember("AUDITOR");
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-${Date.now()}`, location: "", date: new Date() },
    });
    const other = await prisma.user.create({
      data: { email: `other-${Date.now()}@x.test`, password: "x", name: "Other" },
    });

    await prisma.activityLog.create({ data: { type: "ORG_UPDATED", orgId: org.id, userId: u.id } });
    await prisma.activityLog.create({
      data: { type: "EVENT_CREATED", orgId: org.id, eventId: event.id, userId: u.id },
    });
    await prisma.activityLog.create({ data: { type: "EVENT_CREATED", orgId: org.id, userId: other.id } });

    const { GET } = await import("@/app/api/org/[orgId]/activity/route");

    const byType = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/activity?type=ORG_UPDATED`, { method: "GET" }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect((await byType.json()).items).toHaveLength(1);

    const byEvent = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/activity?eventId=${event.id}`, { method: "GET" }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect((await byEvent.json()).items).toHaveLength(1);

    const byUser = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/activity?userId=${other.id}`, { method: "GET" }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect((await byUser.json()).items).toHaveLength(1);

    const inTheFuture = new Date(Date.now() + 3600_000).toISOString();
    const byFrom = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/activity?from=${inTheFuture}`, { method: "GET" }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect((await byFrom.json()).items).toHaveLength(0);

    const inThePast = new Date(Date.now() - 3600_000).toISOString();
    const byTo = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/activity?to=${inThePast}`, { method: "GET" }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    expect((await byTo.json()).items).toHaveLength(0);
  });

  it("paginates via take/cursor and reports hasMore through nextCursor", async () => {
    const { org } = await seedOrgWithMember("AUDITOR");
    // createdAt distincts : la pagination par cursor ordonne par createdAt ; des timestamps
    // identiques (3 inserts dans la meme ms) rendent l'ordre instable. En prod les logs ont
    // des horodatages distincts -> on reproduit ce cas realiste ici.
    for (let i = 0; i < 3; i++) {
      await prisma.activityLog.create({
        data: { type: "ORG_UPDATED", orgId: org.id, createdAt: new Date(Date.now() + i * 1000) },
      });
    }

    const { GET } = await import("@/app/api/org/[orgId]/activity/route");
    const page1 = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/activity?take=2`, { method: "GET" }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    const json1 = await page1.json();
    expect(json1.items).toHaveLength(2);
    expect(json1.nextCursor).not.toBeNull();

    const page2 = await GET(
      new NextRequest(
        `http://localhost/api/org/${org.id}/activity?take=2&cursor=${json1.nextCursor}`,
        { method: "GET" },
      ),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    const json2 = await page2.json();
    expect(json2.items).toHaveLength(1);
    expect(json2.nextCursor).toBeNull();
  });

  it("returns user=null for a log entry without a user", async () => {
    const { org } = await seedOrgWithMember("AUDITOR");
    await prisma.activityLog.create({ data: { type: "ORG_UPDATED", orgId: org.id } });

    const { GET } = await import("@/app/api/org/[orgId]/activity/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/activity`, { method: "GET" }),
      { params: Promise.resolve({ orgId: org.id }) },
    );
    const json = await res.json();
    expect(json.items[0].user).toBeNull();
  });
});
