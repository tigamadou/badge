import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Cleanup post-fichier pour eviter de polluer les fichiers de tests suivants.
afterAll(async () => {
  await prisma.activityLog.deleteMany();
  await prisma.blockedEmail.deleteMany();
  await prisma.blockedDocument.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/mail", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mail")>("@/lib/mail");
  return {
    ...actual,
    sendStatusNotification: vi.fn(async () => undefined),
    sendBadgePrintedNotification: vi.fn(async () => undefined),
  };
});
import { sendStatusNotification, sendBadgePrintedNotification } from "@/lib/mail";

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function seedAdmin() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await prisma.user.create({
    data: { email: `a-${stamp}@x.test`, password: "x", name: "A", emailVerifiedAt: new Date() },
  });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "E", slug: `e-${stamp}`, location: "L", date: new Date() },
  });
  const cat = await prisma.category.create({
    data: { eventId: event.id, name: "V", color: "#000000", number: 1 },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
  return { u, org, event, cat };
}

// v2-11 : cree un User participant complet (profil rempli) pour pouvoir creer
// une Registration ou pour passer en `email` dans le POST /registrations.
async function mkParticipantUser(suffix = "") {
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

async function mkReg(
  eventId: string,
  categoryId: string,
  over: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    idDocumentNumber: string;
  }> = {},
) {
  const user = await mkParticipantUser();
  return prisma.registration.create({
    data: {
      id: `R-${Math.random().toString(36).slice(2, 12)}`,
      eventId,
      categoryId,
      userId: user.id,
      snapshotEmail: over.email ?? `${Math.random().toString(36).slice(2, 8)}@x.test`,
      snapshotLastName: over.lastName ?? "L",
      snapshotFirstName: over.firstName ?? "F",
      snapshotStructure: "S",
      snapshotPhoto: "uploads/test/photo.jpg",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: over.idDocumentNumber ?? `D-${Math.random().toString(36).slice(2, 10)}`,
      snapshotIdDocument: "uploads/test/doc.pdf",
      status: over.status ?? "PENDING",
    },
  });
}

async function cleanup() {
  await prisma.activityLog.deleteMany();
  await prisma.blockedEmail.deleteMany();
  await prisma.blockedDocument.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  vi.mocked(getServerSession).mockReset();
  vi.mocked(sendStatusNotification).mockClear();
  vi.mocked(sendBadgePrintedNotification).mockClear();
}

describe("GET /registrations", () => {
  beforeEach(cleanup);

  it("filters by status", async () => {
    const { u, org, event, cat } = await seedAdmin();
    await mkReg(event.id, cat.id, { status: "PENDING" });
    await mkReg(event.id, cat.id, { status: "APPROVED" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations?status=PENDING`);
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const json = await res.json();
    expect(json.registrations).toHaveLength(1);
    expect(json.registrations[0].status).toBe("PENDING");
  });

  it("searches by q on email/firstName/lastName/document", async () => {
    const { u, org, event, cat } = await seedAdmin();
    await mkReg(event.id, cat.id, { email: "amadou@x.test", firstName: "Amadou" });
    await mkReg(event.id, cat.id, { email: "fatim@x.test", firstName: "Fatim" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations?q=Amadou`);
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const json = await res.json();
    expect(json.registrations).toHaveLength(1);
    expect(json.registrations[0].firstName).toBe("Amadou");
  });

  it("renvoie un DTO aplati, sans cle snapshot", async () => {
    const { u, org, event, cat } = await seedAdmin();
    await mkReg(event.id, cat.id, { email: "dto@x.test", firstName: "Alice", lastName: "Doe" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations`);
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    const row = json.registrations[0];
    expect(row.firstName).toBe("Alice");
    expect(row.email).toBe("dto@x.test");
    expect(Object.keys(row).some((k) => k.startsWith("snapshot"))).toBe(false);
  });

  it("filters by categoryId", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const otherCat = await prisma.category.create({
      data: { eventId: event.id, name: "Other", color: "#111111", number: 2 },
    });
    await mkReg(event.id, cat.id);
    await mkReg(event.id, otherCat.id);
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(
      `http://localhost/api/org/${org.id}/events/${event.id}/registrations?categoryId=${cat.id}`,
    );
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const json = await res.json();
    expect(json.registrations).toHaveLength(1);
    expect(json.registrations[0].category.id).toBe(cat.id);
  });

  it("OPERATOR can read list (defense in depth: scan needs participant infos)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `op-${stamp}@x.test`, password: "x", name: "Op", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-op-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-op-${stamp}`, location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await mkReg(event.id, cat.id);
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations`);
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
  });
});

describe("POST /registrations (manual creation)", () => {
  beforeEach(cleanup);

  it("creates a registration with status=APPROVED by default", async () => {
    const { u, org, event, cat } = await seedAdmin();
    // v2-11 : il faut un User participant avec profil complet
    const participant = await mkParticipantUser("manual");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations`, {
      method: "POST",
      body: JSON.stringify({
        categoryId: cat.id,
        email: participant.email,
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);
    const r = await prisma.registration.findFirst({ where: { eventId: event.id } });
    expect(r?.status).toBe("APPROVED");

    const log = await prisma.activityLog.findFirst({ where: { type: "REGISTRATION_CREATED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("OPERATOR cannot create (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `op-${stamp}@x.test`, password: "x", name: "Op", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-op-c-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-op-c-${stamp}`, location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    const participant = await mkParticipantUser("op-blocked");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations`, {
      method: "POST",
      body: JSON.stringify({
        categoryId: cat.id,
        email: participant.email,
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 VALIDATION when the JSON body is malformed", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations`, {
      method: "POST",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("VALIDATION");
  });

  it("returns 400 INVALID_CATEGORY when categoryId is unknown", async () => {
    const { u, org, event } = await seedAdmin();
    const participant = await mkParticipantUser("bad-cat");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations`, {
      method: "POST",
      body: JSON.stringify({ categoryId: "unknown-cat", email: participant.email }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_CATEGORY");
  });

  it("creates a registration by userId (not email)", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const participant = await mkParticipantUser("by-id");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations`, {
      method: "POST",
      body: JSON.stringify({ categoryId: cat.id, userId: participant.id }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);
    const r = await prisma.registration.findFirst({ where: { eventId: event.id, userId: participant.id } });
    expect(r).not.toBeNull();
  });

  it("returns 404 USER_NOT_FOUND when userId does not exist", async () => {
    const { u, org, event, cat } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations`, {
      method: "POST",
      body: JSON.stringify({ categoryId: cat.id, userId: "does-not-exist" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("USER_NOT_FOUND");
  });

  it("returns 400 PROFILE_INCOMPLETE when the participant profile is not filled", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const incomplete = await prisma.user.create({
      data: { email: `incomplete-${stamp}@x.test`, password: "x", name: "Incomplete", emailVerifiedAt: new Date() },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations`, {
      method: "POST",
      body: JSON.stringify({ categoryId: cat.id, email: incomplete.email }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("PROFILE_INCOMPLETE");
  });

  it("returns 409 ALREADY_REGISTERED when the user already has a registration for this event", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const participant = await mkParticipantUser("dup-manual");
    const existing = await prisma.registration.create({
      data: {
        id: `R-${Math.random().toString(36).slice(2, 12)}`,
        eventId: event.id,
        categoryId: cat.id,
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
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations`, {
      method: "POST",
      body: JSON.stringify({ categoryId: cat.id, email: participant.email }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("ALREADY_REGISTERED");
    expect(json.registrationId).toBe(existing.id);
  });
});

describe("POST /registrations/[regId]/approve", () => {
  beforeEach(cleanup);

  it("approves a pending registration, logs, and sends email", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/approve/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/.../approve`, { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);

    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after?.status).toBe("APPROVED");
    expect(vi.mocked(sendStatusNotification)).toHaveBeenCalledWith(r.id);
    const log = await prisma.activityLog.findFirst({ where: { type: "REGISTRATION_APPROVED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("reactivates a REJECTED registration and clears the rejection reason", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "REJECTED" });
    await prisma.registration.update({
      where: { id: r.id },
      data: { rejectionReason: "Piece illisible" },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/approve/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);
    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after?.status).toBe("APPROVED");
    expect(after?.rejectionReason).toBeNull();
  });

  // ADR 2026-06-01 (v2-14 Task 3) : OPERATOR autorise sur registration.approve.
  // Test inverse de l'ancien "OPERATOR cannot approve (403)" supprime.
  it("OPERATOR can approve (200)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `op-${stamp}@x.test`, password: "x", name: "Op", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-op-a-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-op-a-${stamp}`, location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    const r = await mkReg(event.id, cat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/approve/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);
    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after?.status).toBe("APPROVED");
  });

  // ADR 2026-06-01 (v2-14 Task 3) : VIEWER reste exclu (matrice).
  it("VIEWER cannot approve (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `vw-${stamp}@x.test`, password: "x", name: "Vw", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-vw-a-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-vw-a-${stamp}`, location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "VIEWER" } });
    const r = await mkReg(event.id, cat.id);
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/approve/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(403);
  });

  it("returns alreadyApproved=true without re-approving or emailing", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "APPROVED" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/approve/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.alreadyApproved).toBe(true);
    expect(vi.mocked(sendStatusNotification)).not.toHaveBeenCalled();
  });

  it("swallows a sendStatusNotification failure and still returns 200", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    vi.mocked(sendStatusNotification).mockRejectedValueOnce(new Error("smtp down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/approve/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("returns 404 when regId does not exist", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/approve/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: "does-not-exist" } as never) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when the registration belongs to another event", async () => {
    const { u, org, event } = await seedAdmin();
    const otherEvent = await prisma.event.create({
      data: { orgId: org.id, title: "Other", slug: `other-approve-${Date.now()}`, location: "L", date: new Date() },
    });
    const otherCat = await prisma.category.create({
      data: { eventId: otherEvent.id, name: "V", color: "#000000", number: 1 },
    });
    const r = await mkReg(otherEvent.id, otherCat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/approve/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /registrations/[regId]/reject", () => {
  beforeEach(cleanup);

  // v2-11 : plus de editToken. Le test verifie status + raison + envoi mail.
  it("rejects with reason, sets rejectionReason, sends email", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/reject/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ reason: "Photo illisible", details: "Veuillez fournir une photo nette" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);

    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after?.status).toBe("REJECTED");
    expect(after?.rejectionReason).toBe("Photo illisible");
    expect(vi.mocked(sendStatusNotification)).toHaveBeenCalledWith(r.id);
  });

  it("requires a reason", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/reject/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when the JSON body is malformed (req.json() rejects)", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/reject/route");
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
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/reject/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ reason: "x" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: "does-not-exist" } as never) },
    );
    expect(res.status).toBe(404);
  });

  it("swallows a sendStatusNotification failure and still returns 200", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    vi.mocked(sendStatusNotification).mockRejectedValueOnce(new Error("smtp down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/reject/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ reason: "x" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("POST /registrations/[regId]/print", () => {
  beforeEach(cleanup);

  it("marks badge printed and sends email", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "APPROVED" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/print/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);
    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after?.badgePrinted).toBe(true);
    expect(after?.badgePrintedAt).not.toBeNull();
    expect(vi.mocked(sendBadgePrintedNotification)).toHaveBeenCalledWith(r.id);
  });

  it("refuses to print a non-approved registration", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/print/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(409);
  });

  // ADR 2026-06-01 (v2-14 Task 3) : PRINTER autorise sur badge.print.
  it("PRINTER can print (200)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `pr-${stamp}@x.test`, password: "x", name: "Pr", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-pr-p-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-pr-p-${stamp}`, location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "PRINTER" } });
    const r = await mkReg(event.id, cat.id, { status: "APPROVED" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/print/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);
  });

  // ADR 2026-06-01 (v2-14 Task 3) : VIEWER reste exclu de badge.print.
  it("VIEWER cannot print (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `vw-${stamp}@x.test`, password: "x", name: "Vw", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-vw-p-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-vw-p-${stamp}`, location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "VIEWER" } });
    const r = await mkReg(event.id, cat.id, { status: "APPROVED" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/print/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when regId does not exist", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/print/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: "does-not-exist" } as never) },
    );
    expect(res.status).toBe(404);
  });

  it("swallows a sendBadgePrintedNotification failure and still returns 200", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { status: "APPROVED" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    vi.mocked(sendBadgePrintedNotification).mockRejectedValueOnce(new Error("smtp down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/print/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("PATCH /registrations/[regId]", () => {
  beforeEach(cleanup);

  // v2-11 : le PATCH met a jour les colonnes snapshot* directement (correction
  // typo cote staff). Plus de SubmissionSnapshot, plus de versionnement.
  it("updates snapshot fields and audits", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { firstName: "Old" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await PATCH(
      new NextRequest("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ snapshotFirstName: "New" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);

    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after?.snapshotFirstName).toBe("New");
    const log = await prisma.activityLog.findFirst({ where: { type: "REGISTRATION_UPDATED", targetId: r.id } });
    expect(log).not.toBeNull();
  });

  it("returns 400 when the JSON body is malformed (req.json() rejects)", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id);
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await PATCH(
      new NextRequest("http://localhost/x", {
        method: "PATCH",
        body: "{not-json",
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 VALIDATION for an invalid field", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id);
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await PATCH(
      new NextRequest("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ snapshotEmail: "not-an-email" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when regId does not exist", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await PATCH(
      new NextRequest("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ snapshotFirstName: "New" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: "does-not-exist" } as never) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 INVALID_CATEGORY when categoryId does not belong to the event", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id);
    const otherEvent = await prisma.event.create({
      data: { orgId: org.id, title: "Other", slug: `other-patch-${Date.now()}`, location: "L", date: new Date() },
    });
    const otherCat = await prisma.category.create({
      data: { eventId: otherEvent.id, name: "V", color: "#000000", number: 1 },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await PATCH(
      new NextRequest("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ categoryId: otherCat.id }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_CATEGORY");
  });

  it("moves the registration to another category of the same event (200)", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id);
    const otherCat = await prisma.category.create({
      data: { eventId: event.id, name: "Other", color: "#ffffff", number: 2 },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await PATCH(
      new NextRequest("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ categoryId: otherCat.id }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.registration.categoryId).toBe(otherCat.id);

    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after?.categoryId).toBe(otherCat.id);
  });

  it("OPERATOR cannot PATCH (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `op-${stamp}@x.test`, password: "x", name: "Op", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-op-patch-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-op-patch-${stamp}`, location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    const r = await mkReg(event.id, cat.id);
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await PATCH(
      new NextRequest("http://localhost/x", {
        method: "PATCH",
        body: JSON.stringify({ snapshotFirstName: "New" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /registrations/[regId]", () => {
  beforeEach(cleanup);

  it("returns the registration with its category", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id);
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await GET(
      new NextRequest("http://localhost/x"),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.registration.id).toBe(r.id);
    expect(json.registration.category.id).toBe(cat.id);
  });

  it("returns 404 for an unknown regId", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await GET(
      new NextRequest("http://localhost/x"),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: "does-not-exist" } as never) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when the registration belongs to another event", async () => {
    const { u, org, event } = await seedAdmin();
    const otherEvent = await prisma.event.create({
      data: { orgId: org.id, title: "Other", slug: `other-get-${Date.now()}`, location: "L", date: new Date() },
    });
    const otherCat = await prisma.category.create({
      data: { eventId: otherEvent.id, name: "V", color: "#000000", number: 1 },
    });
    const r = await mkReg(otherEvent.id, otherCat.id);
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await GET(
      new NextRequest("http://localhost/x"),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(404);
  });

  it("VIEWER cannot read the detail (403, minRole=OPERATOR)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `vw-${stamp}@x.test`, password: "x", name: "Vw", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-vw-get-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-vw-get-${stamp}`, location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "VIEWER" } });
    const r = await mkReg(event.id, cat.id);
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await GET(
      new NextRequest("http://localhost/x"),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(403);
  });
});

describe("DELETE /registrations/[regId]", () => {
  beforeEach(cleanup);

  it("deletes the registration and audits", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { email: "todelete@x.test" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { DELETE } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await DELETE(
      new NextRequest("http://localhost/x", { method: "DELETE" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(204);
    const after = await prisma.registration.findUnique({ where: { id: r.id } });
    expect(after).toBeNull();
    const log = await prisma.activityLog.findFirst({ where: { type: "REGISTRATION_DELETED", targetId: r.id } });
    expect((log?.details as { email?: string })?.email).toBe("todelete@x.test");
  });

  it("returns 404 when regId does not exist", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { DELETE } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await DELETE(
      new NextRequest("http://localhost/x", { method: "DELETE" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: "does-not-exist" } as never) },
    );
    expect(res.status).toBe(404);
  });

  it("OPERATOR cannot delete (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `op-${stamp}@x.test`, password: "x", name: "Op", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-op-del-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-op-del-${stamp}`, location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    const r = await mkReg(event.id, cat.id);
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { DELETE } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/route");
    const res = await DELETE(
      new NextRequest("http://localhost/x", { method: "DELETE" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /registrations/[regId]/block-email", () => {
  beforeEach(cleanup);

  it("adds the registration email to BlockedEmail", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { email: "block@x.test" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/block-email/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ reason: "spam" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(201);
    const blocked = await prisma.blockedEmail.findFirst({ where: { eventId: event.id, email: "block@x.test" } });
    expect(blocked).not.toBeNull();
  });

  it("returns 404 when regId does not exist", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/block-email/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: "does-not-exist" } as never) },
    );
    expect(res.status).toBe(404);
  });

  it("is idempotent when the email is already blocked for the event (P2002 swallowed)", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { email: "already-blocked@x.test" });
    await prisma.blockedEmail.create({ data: { eventId: event.id, email: "already-blocked@x.test", reason: "prior" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/block-email/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ reason: "spam again" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(201);
    const count = await prisma.blockedEmail.count({ where: { eventId: event.id, email: "already-blocked@x.test" } });
    expect(count).toBe(1);
  });

  it("defaults to no reason when the JSON body is malformed", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { email: "malformed-body@x.test" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/block-email/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: "{not-json",
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(201);
    const blocked = await prisma.blockedEmail.findFirst({ where: { eventId: event.id, email: "malformed-body@x.test" } });
    expect(blocked?.reason).toBeNull();
  });

  // Distinct de "JSON malformed" ci-dessus : ici le JSON est valide mais le champ
  // `reason` a un type invalide -> parsed.success === false -> branche `: null` du ternaire.
  it("defaults to no reason when reason has an invalid type (schema validation fails)", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { email: "invalid-type@x.test" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/block-email/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ reason: 12345 }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(201);
    const blocked = await prisma.blockedEmail.findFirst({ where: { eventId: event.id, email: "invalid-type@x.test" } });
    expect(blocked?.reason).toBeNull();
  });

  it("rethrows when blockedEmail.create fails with a non-P2002 error", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r = await mkReg(event.id, cat.id, { email: "rethrow-email@x.test" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const err = Object.assign(new Error("db down"), { code: "P2003" });
    const spy = vi.spyOn(prisma.blockedEmail, "create").mockRejectedValueOnce(err);

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/block-email/route");
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

describe("GET /registrations/[regId]/duplicates", () => {
  beforeEach(cleanup);

  it("returns duplicates matched on email/name/document within event", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r1 = await mkReg(event.id, cat.id, { email: "dup@x.test" });
    const r2 = await mkReg(event.id, cat.id, { email: "dup@x.test" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/duplicates/route");
    const res = await GET(
      new NextRequest("http://localhost/x"),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r1.id } as never) },
    );
    const json = await res.json();
    expect(json.duplicates).toHaveLength(1);
    expect(json.duplicates[0].id).toBe(r2.id);
  });
});

describe("GET /registrations/export (CSV)", () => {
  beforeEach(cleanup);

  it("returns text/csv with header + rows", async () => {
    const { u, org, event, cat } = await seedAdmin();
    await mkReg(event.id, cat.id, { firstName: "Amadou", lastName: "Diallo" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/export/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations/export`),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain("Amadou");
    expect(body.split("\n")[0]).toContain("firstName");
  });

  it("OPERATOR cannot export (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `op-exp-${stamp}@x.test`, password: "x", name: "Op", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-exp-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-exp-${stamp}`, location: "L", date: new Date() },
    });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "OPERATOR" },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/export/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations/export`),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(403);
  });
});

describe("Quota — admin bypass with audit", () => {
  beforeEach(cleanup);

  it("admin can create even if quota exceeded — log includes quotaBypass=true", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `a-${stamp}@x.test`, password: "x", name: "A", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({
      data: { name: "O", slug: `qq-o-${stamp}` },
    });
    const plan = await prisma.plan.create({
      data: { name: `plan-${stamp}`, maxEvents: null, maxParticipantsPerEvent: 1 },
    });
    await prisma.subscription.create({
      data: { orgId: org.id, planId: plan.id, status: "ACTIVE" },
    });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `qq-e-${stamp}`, location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000000", number: 1 } });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
    const seedUser = await mkParticipantUser("seed");
    await prisma.registration.create({
      data: {
        id: "R1",
        eventId: event.id,
        categoryId: cat.id,
        userId: seedUser.id,
        snapshotEmail: "a@x.test",
        snapshotLastName: "L",
        snapshotFirstName: "F",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "D1",
        snapshotIdDocument: "uploads/test/doc.pdf",
        status: "APPROVED",
      },
    });
    const newParticipant = await mkParticipantUser("second");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations`, {
      method: "POST",
      body: JSON.stringify({
        categoryId: cat.id,
        email: newParticipant.email,
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(201);

    const log = await prisma.activityLog.findFirst({
      where: { type: "REGISTRATION_CREATED", targetId: { not: "R1" } },
    });
    expect((log?.details as { quotaBypass?: boolean })?.quotaBypass).toBe(true);
  });
});

describe("POST /registrations/[regId]/checkin", () => {
  beforeEach(cleanup);

  it("OPERATOR can checkin (writes BADGE_SCANNED log)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `op-${stamp}@x.test`, password: "x", name: "Op", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-ci-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-ci-${stamp}`, location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({ data: { eventId: event.id, name: "V", color: "#000000", number: 1 } });
    const r = await mkReg(event.id, cat.id, { status: "APPROVED" });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/checkin/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(200);
    const log = await prisma.activityLog.findFirst({ where: { type: "BADGE_SCANNED" } });
    expect(log?.userId).toBe(u.id);
    expect(log?.eventId).toBe(event.id);
  });

  it("VIEWER cannot checkin (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `vw-chk-${stamp}@x.test`, password: "x", name: "Vw", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-chk-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-chk-${stamp}`, location: "L", date: new Date() },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000000", number: 1 },
    });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "VIEWER" },
    });
    const r = await mkReg(event.id, cat.id, { status: "APPROVED" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import(
      "@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/checkin/route"
    );
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: r.id } as never) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 FOREIGN_EVENT when regId does not belong to the event", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `op-${stamp}@x.test`, password: "x", name: "Op", emailVerifiedAt: new Date() },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-ci-404-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-ci-404-${stamp}`, location: "L", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/checkin/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: "does-not-exist" } as never) },
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe("FOREIGN_EVENT");
  });
});

describe("POST /registrations/print (batch)", () => {
  beforeEach(cleanup);

  it("returns 400 VALIDATION when the JSON body is malformed", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/print/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations/print`, {
        method: "POST",
        body: "{not-json",
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 VALIDATION when ids is empty", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/print/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations/print`, {
        method: "POST",
        body: JSON.stringify({ ids: [] }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(400);
  });

  it("marks the approved registrations printed, logs BADGE_BATCH_PRINTED, and swallows a mail failure", async () => {
    const { u, org, event, cat } = await seedAdmin();
    const r1 = await mkReg(event.id, cat.id, { status: "APPROVED" });
    const r2 = await mkReg(event.id, cat.id, { status: "APPROVED" });
    const pending = await mkReg(event.id, cat.id, { status: "PENDING" });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    vi.mocked(sendBadgePrintedNotification).mockRejectedValueOnce(new Error("smtp down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/print/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/registrations/print`, {
        method: "POST",
        body: JSON.stringify({ ids: [r1.id, r2.id, pending.id] }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.printed).toBe(2);
    const after1 = await prisma.registration.findUnique({ where: { id: r1.id } });
    const afterPending = await prisma.registration.findUnique({ where: { id: pending.id } });
    expect(after1?.badgePrinted).toBe(true);
    expect(afterPending?.badgePrinted).toBe(false);
    const log = await prisma.activityLog.findFirst({ where: { type: "BADGE_BATCH_PRINTED", eventId: event.id } });
    expect((log?.details as { count?: number })?.count).toBe(2);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
