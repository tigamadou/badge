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
    expect(json.registrations[0].snapshotFirstName).toBe("Amadou");
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
});
