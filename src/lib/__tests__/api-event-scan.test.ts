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

async function seedOperator() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await prisma.user.create({
    data: { email: `op-${stamp}@x.fr`, password: "x", name: "Op", emailVerifiedAt: new Date() },
  });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${stamp}`, location: "L", date: new Date() },
  });
  const cat = await prisma.category.create({
    data: { eventId: event.id, name: "V", color: "#000000", number: 1 },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
  return { u, org, event, cat };
}

async function mkParticipant(suffix: string) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${suffix}`;
  return prisma.user.create({
    data: {
      email: `p-${stamp}@x.fr`,
      password: "x",
      name: "P",
      emailVerifiedAt: new Date(),
    },
  });
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

describe("POST /scan/verify", () => {
  beforeEach(cleanup);

  it("APPROVED badge -> authorized=true + BADGE_SCANNED log", async () => {
    const { u, org, event, cat } = await seedOperator();
    const p = await mkParticipant("ok");
    const r = await prisma.registration.create({
      data: {
        id: "REG-OK",
        eventId: event.id,
        categoryId: cat.id,
        userId: p.id,
        snapshotEmail: "x@x.fr",
        snapshotLastName: "L",
        snapshotFirstName: "F",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "D",
        snapshotIdDocument: "uploads/test/doc.pdf",
        status: "APPROVED",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/scan/verify/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ payload: r.id }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.authorized).toBe(true);
    expect(json.registration.firstName).toBe("F");
    const log = await prisma.activityLog.findFirst({ where: { type: "BADGE_SCANNED" } });
    expect(log?.userId).toBe(u.id);
  });

  it("extracts badgeId from QR URL payload", async () => {
    const { u, org, event, cat } = await seedOperator();
    const p = await mkParticipant("qr");
    const r = await prisma.registration.create({
      data: {
        id: "REG-QR",
        eventId: event.id,
        categoryId: cat.id,
        userId: p.id,
        snapshotEmail: "x@x.fr",
        snapshotLastName: "L",
        snapshotFirstName: "F",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "D",
        snapshotIdDocument: "uploads/test/doc.pdf",
        status: "APPROVED",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/scan/verify/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ payload: "https://example.com/verify/REG-QR" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.registration.id).toBe(r.id);
  });

  it("badge from another event -> code=FOREIGN_EVENT", async () => {
    const { u, org, event } = await seedOperator();
    const otherStamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const otherOrg = await prisma.organization.create({ data: { name: "B", slug: `b-${otherStamp}` } });
    const otherEvt = await prisma.event.create({
      data: { orgId: otherOrg.id, title: "X", slug: `x-${otherStamp}`, location: "", date: new Date() },
    });
    const cat = await prisma.category.create({
      data: { eventId: otherEvt.id, name: "V", color: "#000000", number: 1 },
    });
    const p = await mkParticipant("foreign");
    await prisma.registration.create({
      data: {
        id: "REG-FOREIGN",
        eventId: otherEvt.id,
        categoryId: cat.id,
        userId: p.id,
        snapshotEmail: "x@x.fr",
        snapshotLastName: "L",
        snapshotFirstName: "F",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "D",
        snapshotIdDocument: "uploads/test/doc.pdf",
        status: "APPROVED",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/scan/verify/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ payload: "REG-FOREIGN" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe("FOREIGN_EVENT");
    expect(json.message).toContain("autre événement");
  });

  it("REJECTED badge -> authorized=false", async () => {
    const { u, org, event, cat } = await seedOperator();
    const p = await mkParticipant("rej");
    await prisma.registration.create({
      data: {
        id: "REG-REJ",
        eventId: event.id,
        categoryId: cat.id,
        userId: p.id,
        snapshotEmail: "x@x.fr",
        snapshotLastName: "L",
        snapshotFirstName: "F",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "D",
        snapshotIdDocument: "uploads/test/doc.pdf",
        status: "REJECTED",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/scan/verify/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ payload: "REG-REJ" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.authorized).toBe(false);
    expect(json.registration.status).toBe("REJECTED");
  });
});
