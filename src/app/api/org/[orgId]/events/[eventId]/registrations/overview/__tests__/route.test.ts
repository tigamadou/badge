import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function mkParticipantUser(suffix: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${suffix}`;
  return prisma.user.create({
    data: {
      email: `p-${stamp}@x.test`,
      password: "x",
      name: "Participant",
      emailVerifiedAt: new Date(),
      firstName: "F",
      lastName: "L",
      structure: "S",
      photo: "uploads/test/photo.jpg",
      idDocumentType: "CNI",
      idDocumentNumber: `D-${stamp}`,
      idDocument: "uploads/test/doc.pdf",
      participantProfileCompletedAt: new Date(),
    },
  });
}

async function mkReg(eventId: string, categoryId: string, status: "PENDING" | "APPROVED" | "REJECTED") {
  const participant = await mkParticipantUser("reg");
  return prisma.registration.create({
    data: {
      id: `R-${Math.random().toString(36).slice(2, 12)}`,
      eventId,
      categoryId,
      userId: participant.id,
      snapshotEmail: participant.email,
      snapshotLastName: "L",
      snapshotFirstName: "F",
      snapshotStructure: "S",
      snapshotPhoto: "uploads/test/photo.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: `D-${Math.random().toString(36).slice(2, 10)}`,
      snapshotIdDocument: "uploads/test/doc.pdf",
      status,
    },
  });
}

async function seedEvent(role: "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER" = "VIEWER") {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await prisma.user.create({
    data: { email: `u-${stamp}@x.test`, password: "x", name: "U", emailVerifiedAt: new Date() },
  });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-ov-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-ov-${stamp}`, location: "L", date: new Date() },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role } });
  return { u, org, event };
}

describe("GET /registrations/overview", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("returns totals, byCategory breakdown, and quota for a VIEWER", async () => {
    const { u, org, event } = await seedEvent("VIEWER");
    const cat1 = await prisma.category.create({
      data: { eventId: event.id, name: "V1", color: "#000000", number: 1 },
    });
    const cat2 = await prisma.category.create({
      data: { eventId: event.id, name: "V2", color: "#111111", number: 2 },
    });
    await mkReg(event.id, cat1.id, "PENDING");
    await mkReg(event.id, cat1.id, "APPROVED");
    await mkReg(event.id, cat2.id, "REJECTED");

    const plan = await prisma.plan.create({
      data: {
        name: `plan-ov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        maxEvents: null,
        maxParticipantsPerEvent: 100,
      },
    });
    await prisma.subscription.create({ data: { orgId: org.id, planId: plan.id, status: "ACTIVE" } });

    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/x"),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.totals).toEqual({ pending: 1, approved: 1, rejected: 1 });
    expect(json.quota.max).toBe(100);
    expect(json.quota.usedCountable).toBe(2);

    expect(json.byCategory).toHaveLength(2);
    const byCat1 = json.byCategory.find((row: { categoryId: string }) => row.categoryId === cat1.id);
    const byCat2 = json.byCategory.find((row: { categoryId: string }) => row.categoryId === cat2.id);
    expect(byCat1.count).toBe(2);
    expect(byCat1.category.name).toBe("V1");
    expect(byCat2.count).toBe(1);
  });

  it("defaults totals to 0, quota.max to null and byCategory to [] when there is no data", async () => {
    const { u, org, event } = await seedEvent("VIEWER");
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/x"),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totals).toEqual({ pending: 0, approved: 0, rejected: 0 });
    expect(json.byCategory).toEqual([]);
    expect(json.quota.max).toBeNull();
    expect(json.quota.usedCountable).toBe(0);
  });

  it("returns 401 when not authenticated", async () => {
    const { org, event } = await seedEvent("VIEWER");
    vi.mocked(getServerSession).mockResolvedValue(null as never);

    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/x"),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a user without any event membership", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-ov-403-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-ov-403-${stamp}`, location: "L", date: new Date() },
    });
    const outsider = await prisma.user.create({
      data: { email: `outsider-${stamp}@x.test`, password: "x", name: "Out", emailVerifiedAt: new Date() },
    });
    withSession({ id: outsider.id, email: outsider.email, name: outsider.name, isStaff: false });

    const { GET } = await import("../route");
    const res = await GET(
      new NextRequest("http://localhost/x"),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(403);
  });
});
