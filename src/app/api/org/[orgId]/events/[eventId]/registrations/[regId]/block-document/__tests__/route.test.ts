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
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-bd-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-bd-${stamp}`, location: "L", date: new Date() },
  });
  const cat = await prisma.category.create({
    data: { eventId: event.id, name: "V", color: "#000000", number: 1 },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role } });
  return { u, org, event, cat };
}

async function mkReg(eventId: string, categoryId: string, documentNumber?: string) {
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
      snapshotIdDocumentNumber: documentNumber ?? `D-${Math.random().toString(36).slice(2, 10)}`,
      snapshotIdDocument: "uploads/test/doc.pdf",
      status: "APPROVED",
    },
  });
}

describe("POST /registrations/[regId]/block-document", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("blocks the registration's document number and audits", async () => {
    const { u, org, event, cat } = await seedEvent("ADMIN");
    const r = await mkReg(event.id, cat.id, "DOC-BLOCK-1");
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ reason: "fraude" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(201);

    const blocked = await prisma.blockedDocument.findFirst({
      where: { eventId: event.id, documentNumber: "DOC-BLOCK-1" },
    });
    expect(blocked).not.toBeNull();
    expect(blocked?.reason).toBe("fraude");

    const log = await prisma.activityLog.findFirst({
      where: { type: "REGISTRATION_UPDATED", targetId: r.id },
    });
    expect(log).not.toBeNull();
    expect((log?.details as { action?: string })?.action).toBe("block-document");
  });

  it("works without a reason (optional field)", async () => {
    const { u, org, event, cat } = await seedEvent("ADMIN");
    const r = await mkReg(event.id, cat.id, "DOC-NO-REASON");
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(201);
    const blocked = await prisma.blockedDocument.findFirst({
      where: { eventId: event.id, documentNumber: "DOC-NO-REASON" },
    });
    expect(blocked?.reason).toBeNull();
  });

  it("returns 401 when not authenticated", async () => {
    const { org, event, cat } = await seedEvent("ADMIN");
    const r = await mkReg(event.id, cat.id);
    vi.mocked(getServerSession).mockResolvedValue(null as never);

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(401);
  });

  it("OPERATOR cannot block a document (403, sans registration.block)", async () => {
    const { u, org, event, cat } = await seedEvent("OPERATOR");
    const r = await mkReg(event.id, cat.id);
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when regId does not exist", async () => {
    const { u, org, event } = await seedEvent("ADMIN");
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: "does-not-exist" } as never) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when the registration belongs to another event", async () => {
    const { u, org, event } = await seedEvent("ADMIN");
    const otherEvent = await prisma.event.create({
      data: { orgId: org.id, title: "Other", slug: `other-bd-${Date.now()}`, location: "L", date: new Date() },
    });
    const otherCat = await prisma.category.create({
      data: { eventId: otherEvent.id, name: "V", color: "#000000", number: 1 },
    });
    const r = await mkReg(otherEvent.id, otherCat.id);
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(404);
  });

  it("is idempotent when the document is already blocked for the event (P2002 swallowed)", async () => {
    const { u, org, event, cat } = await seedEvent("ADMIN");
    const r = await mkReg(event.id, cat.id, "DOC-DUP");
    await prisma.blockedDocument.create({ data: { eventId: event.id, documentNumber: "DOC-DUP", reason: "prior" } });
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ reason: "again" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(201);
    const count = await prisma.blockedDocument.count({ where: { eventId: event.id, documentNumber: "DOC-DUP" } });
    expect(count).toBe(1);
  });

  it("defaults to no reason when the JSON body is malformed", async () => {
    const { u, org, event, cat } = await seedEvent("ADMIN");
    const r = await mkReg(event.id, cat.id, "DOC-MALFORMED");
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
    expect(res.status).toBe(201);
    const blocked = await prisma.blockedDocument.findFirst({
      where: { eventId: event.id, documentNumber: "DOC-MALFORMED" },
    });
    expect(blocked?.reason).toBeNull();
  });

  // Distinct de "JSON malformed" ci-dessus : ici le JSON est valide mais le champ
  // `reason` a un type invalide -> parsed.success === false -> branche `: null` du ternaire.
  it("defaults to no reason when reason has an invalid type (schema validation fails)", async () => {
    const { u, org, event, cat } = await seedEvent("ADMIN");
    const r = await mkReg(event.id, cat.id, "DOC-INVALID-TYPE");
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("../route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ reason: 12345 }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(201);
    const blocked = await prisma.blockedDocument.findFirst({
      where: { eventId: event.id, documentNumber: "DOC-INVALID-TYPE" },
    });
    expect(blocked?.reason).toBeNull();
  });

  it("rethrows when blockedDocument.create fails with a non-P2002 error", async () => {
    const { u, org, event, cat } = await seedEvent("ADMIN");
    const r = await mkReg(event.id, cat.id, "DOC-RETHROW");
    withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const err = Object.assign(new Error("db down"), { code: "P2003" });
    const spy = vi.spyOn(prisma.blockedDocument, "create").mockRejectedValueOnce(err);

    const { POST } = await import("../route");
    await expect(
      POST(
        new NextRequest("http://localhost/x", {
          method: "POST",
          body: JSON.stringify({ reason: "x" }),
          headers: { "content-type": "application/json" },
        }),
        { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
      ),
    ).rejects.toThrow("db down");
    spy.mockRestore();
  });
});
