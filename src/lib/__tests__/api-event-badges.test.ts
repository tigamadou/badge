import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/mail", () => ({
  sendBadgePrintedNotification: vi.fn().mockResolvedValue(undefined),
}));

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

async function seed(role: "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER") {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await prisma.user.create({
    data: { email: `u-${stamp}@x.test`, password: "x", name: "U" },
  });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${stamp}`, location: "L", date: new Date() },
  });
  const cat = await prisma.category.create({
    data: { eventId: event.id, name: "V", color: "#000000", number: 1 },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role } });
  return { u, org, event, cat };
}

async function cleanup() {
  await prisma.activityLog.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  vi.mocked(getServerSession).mockReset();
}

describe("Badges API — GET /registrations contract used by /badges page", () => {
  beforeEach(cleanup);

  it("returns fields needed by BadgeListTable (badgePrinted, allAccessGranted, category)", async () => {
    const { u, org, event, cat } = await seed("OPERATOR");
    await prisma.registration.create({
      data: {
        id: "REG-LIST-1",
        eventId: event.id,
        categoryId: cat.id,
        email: "a@x.fr",
        firstName: "Alice",
        lastName: "Dupont",
        structure: "Acme",
        idDocumentType: "CNI",
        idDocumentNumber: "X1",
        status: "APPROVED",
        badgePrinted: false,
        allAccessGranted: true,
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/admin/[orgId]/events/[eventId]/registrations/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/registrations?status=APPROVED&limit=100`),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.registrations)).toBe(true);
    const row = json.registrations[0];
    expect(row.id).toBe("REG-LIST-1");
    expect(row.badgePrinted).toBe(false);
    expect(row.allAccessGranted).toBe(true);
    expect(row.category).toMatchObject({ name: "V", color: "#000000", number: 1 });
  });
});

describe("Badges API — POST /registrations/print", () => {
  beforeEach(cleanup);

  it("marks APPROVED registrations as printed + logs BADGE_BATCH_PRINTED (ADMIN only)", async () => {
    const { u, org, event, cat } = await seed("ADMIN");
    const r1 = await prisma.registration.create({
      data: {
        id: "REG-P-1",
        eventId: event.id,
        categoryId: cat.id,
        email: "a@x.fr",
        firstName: "A",
        lastName: "L",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "X1",
        status: "APPROVED",
      },
    });
    const r2 = await prisma.registration.create({
      data: {
        id: "REG-P-2",
        eventId: event.id,
        categoryId: cat.id,
        email: "b@x.fr",
        firstName: "B",
        lastName: "L",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "X2",
        status: "APPROVED",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/registrations/print/route"
    );
    const res = await POST(
      new NextRequest(`http://localhost/x`, {
        method: "POST",
        body: JSON.stringify({ ids: [r1.id, r2.id] }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.printed).toBe(2);

    const updated = await prisma.registration.findMany({
      where: { id: { in: [r1.id, r2.id] } },
    });
    expect(updated.every((x) => x.badgePrinted)).toBe(true);
    expect(updated.every((x) => x.badgePrintedAt !== null)).toBe(true);

    const log = await prisma.activityLog.findFirst({ where: { type: "BADGE_BATCH_PRINTED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("ignores non-APPROVED registrations silently", async () => {
    const { u, org, event, cat } = await seed("ADMIN");
    const pending = await prisma.registration.create({
      data: {
        id: "REG-PENDING",
        eventId: event.id,
        categoryId: cat.id,
        email: "p@x.fr",
        firstName: "P",
        lastName: "L",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "P",
        status: "PENDING",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/registrations/print/route"
    );
    const res = await POST(
      new NextRequest(`http://localhost/x`, {
        method: "POST",
        body: JSON.stringify({ ids: [pending.id] }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.printed).toBe(0);
    const reload = await prisma.registration.findUnique({ where: { id: pending.id } });
    expect(reload?.badgePrinted).toBe(false);
  });

  it("OPERATOR cannot batch print (403)", async () => {
    const { u, org, event, cat } = await seed("OPERATOR");
    const r = await prisma.registration.create({
      data: {
        id: "REG-OP",
        eventId: event.id,
        categoryId: cat.id,
        email: "o@x.fr",
        firstName: "O",
        lastName: "L",
        structure: "S",
        idDocumentType: "CNI",
        idDocumentNumber: "O",
        status: "APPROVED",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/registrations/print/route"
    );
    const res = await POST(
      new NextRequest(`http://localhost/x`, {
        method: "POST",
        body: JSON.stringify({ ids: [r.id] }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(403);
  });
});
