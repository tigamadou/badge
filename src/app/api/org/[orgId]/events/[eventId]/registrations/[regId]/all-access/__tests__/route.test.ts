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

async function seedEvent(role: "ADMIN" | "OPERATOR" | "PRINTER" | "VIEWER" = "ADMIN") {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await prisma.user.create({
    data: { email: `u-${stamp}@x.test`, password: "x", name: "U", emailVerifiedAt: new Date() },
  });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-aa-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-aa-${stamp}`, location: "L", date: new Date() },
  });
  const cat = await prisma.category.create({
    data: { eventId: event.id, name: "V", color: "#000000", number: 1 },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role } });
  return { u, org, event, cat };
}

async function mkReg(eventId: string, categoryId: string) {
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
      status: "APPROVED",
    },
  });
}

describe("POST /registrations/[regId]/all-access", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("grants all-access and audits BADGE_ALL_ACCESS_TOGGLED", async () => {
    const { u, org, event, cat } = await seedEvent("ADMIN");
    const r = await mkReg(event.id, cat.id);
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ allAccessGranted: true }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);

    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after?.allAccessGranted).toBe(true);

    const log = await prisma.activityLog.findFirst({ where: { type: "BADGE_ALL_ACCESS_TOGGLED", targetId: r.id } });
    expect(log).not.toBeNull();
    expect((log?.details as { value?: boolean })?.value).toBe(true);
  });

  it("revokes all-access", async () => {
    const { u, org, event, cat } = await seedEvent("ADMIN");
    const r = await mkReg(event.id, cat.id);
    await prisma.registration.update({ where: { id: r.id }, data: { allAccessGranted: true } });
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ allAccessGranted: false }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);
    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after?.allAccessGranted).toBe(false);
  });

  it("returns 401 when not authenticated", async () => {
    const { org, event, cat } = await seedEvent("ADMIN");
    const r = await mkReg(event.id, cat.id);
    vi.mocked(getServerSession).mockResolvedValue(null as never);

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ allAccessGranted: true }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(401);
  });

  it("OPERATOR cannot toggle all-access (403, minRole=ADMIN)", async () => {
    const { u, org, event, cat } = await seedEvent("OPERATOR");
    const r = await mkReg(event.id, cat.id);
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ allAccessGranted: true }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 VALIDATION when allAccessGranted is missing or not a boolean", async () => {
    const { u, org, event, cat } = await seedEvent("ADMIN");
    const r = await mkReg(event.id, cat.id);
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ allAccessGranted: "yes" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 VALIDATION when the JSON body is malformed", async () => {
    const { u, org, event, cat } = await seedEvent("ADMIN");
    const r = await mkReg(event.id, cat.id);
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: "{not-json",
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when regId does not exist", async () => {
    const { u, org, event } = await seedEvent("ADMIN");
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ allAccessGranted: true }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: "does-not-exist" } as never) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when the registration belongs to another event", async () => {
    const { u, org, event } = await seedEvent("ADMIN");
    const otherEvent = await prisma.event.create({
      data: { orgId: org.id, title: "Other", slug: `other-aa-${Date.now()}`, location: "L", date: new Date() },
    });
    const otherCat = await prisma.category.create({
      data: { eventId: otherEvent.id, name: "V", color: "#000000", number: 1 },
    });
    const r = await mkReg(otherEvent.id, otherCat.id);
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ allAccessGranted: true }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(404);
  });
});
