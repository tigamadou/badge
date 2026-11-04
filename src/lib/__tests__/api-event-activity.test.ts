import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

afterAll(async () => {
  await prisma.activityLog.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function cleanup() {
  await prisma.activityLog.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  vi.mocked(getServerSession).mockReset();
}

type Scaffold = {
  admin: { id: string; email: string; name: string };
  operator: { id: string; email: string; name: string };
  org: { id: string };
  event: { id: string };
};

async function scaffold(): Promise<Scaffold> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const admin = await prisma.user.create({
    data: { email: `admin-${stamp}@x.test`, password: "x", name: "Admin" },
  });
  const operator = await prisma.user.create({
    data: { email: `op-${stamp}@x.test`, password: "x", name: "Op" },
  });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${stamp}`, location: "L", date: new Date() },
  });
  await prisma.eventMembership.create({
    data: { userId: admin.id, eventId: event.id, role: "ADMIN" },
  });
  await prisma.eventMembership.create({
    data: { userId: operator.id, eventId: event.id, role: "OPERATOR" },
  });
  return { admin, operator, org, event };
}

describe("GET /api/org/[orgId]/events/[eventId]/activity", () => {
  beforeEach(cleanup);

  it("ADMIN sees all activity for the event", async () => {
    const { admin, operator, org, event } = await scaffold();
    await prisma.activityLog.createMany({
      data: [
        { type: "REGISTRATION_CREATED", userId: admin.id, eventId: event.id, orgId: org.id },
        { type: "BADGE_SCANNED", userId: operator.id, eventId: event.id, orgId: org.id },
        { type: "BADGE_SCANNED", userId: admin.id, eventId: event.id, orgId: org.id },
      ],
    });
    await withSession({ id: admin.id, email: admin.email, name: admin.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/activity/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/activity`),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { logs: Array<{ type: string }>; total: number };
    expect(json.total).toBe(3);
    expect(json.logs).toHaveLength(3);
  });

  it("OPERATOR sees only their own BADGE_SCANNED entries", async () => {
    const { admin, operator, org, event } = await scaffold();
    await prisma.activityLog.createMany({
      data: [
        { type: "REGISTRATION_CREATED", userId: admin.id, eventId: event.id, orgId: org.id },
        { type: "BADGE_SCANNED", userId: operator.id, eventId: event.id, orgId: org.id },
        { type: "BADGE_SCANNED", userId: admin.id, eventId: event.id, orgId: org.id },
        { type: "REGISTRATION_UPDATED", userId: operator.id, eventId: event.id, orgId: org.id },
      ],
    });
    await withSession({
      id: operator.id,
      email: operator.email,
      name: operator.name,
      isStaff: false,
    });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/activity/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/activity`),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      logs: Array<{ type: string }>;
      total: number;
    };
    expect(json.total).toBe(1);
    expect(json.logs).toHaveLength(1);
    expect(json.logs[0].type).toBe("BADGE_SCANNED");
  });

  it("ADMIN can filter by type", async () => {
    const { admin, org, event } = await scaffold();
    await prisma.activityLog.createMany({
      data: [
        { type: "REGISTRATION_CREATED", userId: admin.id, eventId: event.id, orgId: org.id },
        { type: "BADGE_SCANNED", userId: admin.id, eventId: event.id, orgId: org.id },
        { type: "BADGE_SCANNED", userId: admin.id, eventId: event.id, orgId: org.id },
      ],
    });
    await withSession({ id: admin.id, email: admin.email, name: admin.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/activity/route");
    const res = await GET(
      new NextRequest(
        `http://localhost/api/org/${org.id}/events/${event.id}/activity?type=BADGE_SCANNED`,
      ),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    const json = (await res.json()) as { total: number; logs: Array<{ type: string }> };
    expect(json.total).toBe(2);
    expect(json.logs.every((l) => l.type === "BADGE_SCANNED")).toBe(true);
  });

  it("VIEWER cannot access activity (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `viewer-${stamp}@x.test`, password: "x", name: "V" },
    });
    const org = await prisma.organization.create({
      data: { name: "O", slug: `o-v-${stamp}` },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "E",
        slug: `e-v-${stamp}`,
        location: "L",
        date: new Date(),
      },
    });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "VIEWER" },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/activity/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/activity`),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(403);
  });

  it("pagine par page et pageSize (liste commune)", async () => {
    const { admin, org, event } = await scaffold();
    await prisma.activityLog.createMany({
      data: Array.from({ length: 25 }).map(() => ({
        type: "BADGE_SCANNED" as const,
        userId: admin.id,
        eventId: event.id,
        orgId: org.id,
      })),
    });
    await withSession({ id: admin.id, email: admin.email, name: admin.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/activity/route");
    const call = async (qs: string) => {
      const res = await GET(new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/activity?${qs}`), {
        params: Promise.resolve({ orgId: org.id, eventId: event.id }),
      });
      return (await res.json()) as { total: number; logs: unknown[]; page: number; pageSize: number };
    };

    const ten = await call("page=3&pageSize=10");
    expect(ten).toMatchObject({ total: 25, page: 3, pageSize: 10 });
    expect(ten.logs).toHaveLength(5);
    expect(ten).not.toHaveProperty("limit");

    const fallback = await call("pageSize=3");
    expect(fallback.pageSize).toBe(20);
    expect(fallback.logs).toHaveLength(20);

    const all = await call("pageSize=500");
    expect(all.logs).toHaveLength(25);
  });
});
