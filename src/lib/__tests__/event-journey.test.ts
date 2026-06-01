import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/mail", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mail")>("@/lib/mail");
  return {
    ...actual,
    sendStatusNotification: vi.fn(async () => undefined),
    sendBadgePrintedNotification: vi.fn(async () => undefined),
    sendUserInvitation: vi.fn(async () => undefined),
  };
});
import { sendStatusNotification, sendBadgePrintedNotification } from "@/lib/mail";

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

describe("ADMIN journey (smoke)", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
    vi.mocked(sendStatusNotification).mockClear();
    vi.mocked(sendBadgePrintedNotification).mockClear();
  });

  it("OWNER (no EventMembership) inherits ADMIN: creates category + registration + prints badge", async () => {
    const owner = await prisma.user.create({
      data: {
        email: "owner@journey.test",
        password: "x",
        name: "O",
        emailVerifiedAt: new Date(),
      },
    });
    const org = await prisma.organization.create({ data: { name: "Acme", slug: "acme-journey" } });
    await prisma.orgMembership.create({
      data: { userId: owner.id, orgId: org.id, role: "OWNER" },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Salon 2026",
        slug: "salon-2026-journey",
        location: "Abidjan",
        date: new Date("2026-10-01"),
      },
    });
    await withSession({ id: owner.id, email: owner.email, name: owner.name, isStaff: false });

    // 1. OWNER cree une categorie (heritage OWNER -> ADMIN sur l'event)
    const { POST: createCat } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/categories/route"
    );
    const r1 = await createCat(
      new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/categories`, {
        method: "POST",
        body: JSON.stringify({ name: "VIP", color: "#ff0000", number: 1 }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(r1.status).toBe(201);
    const cat = await prisma.category.findFirst({ where: { eventId: event.id } });
    expect(cat).toBeTruthy();

    // 2. ADMIN cree une inscription manuelle (APPROVED par defaut)
    // v2-11 : le participant doit exister en tant que User avec profil complet.
    await prisma.user.create({
      data: {
        email: "amadou@journey.test",
        password: "x",
        name: "Amadou Diallo",
        emailVerifiedAt: new Date(),
        firstName: "Amadou",
        lastName: "Diallo",
        structure: "ENSEA",
        photo: "uploads/test/photo.jpg",
        idDocumentType: "CNI",
        idDocumentNumber: "CNI-JOURNEY-1",
        idDocument: "uploads/test/doc.pdf",
        participantProfileCompletedAt: new Date(),
      },
    });
    const { POST: createReg } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/registrations/route"
    );
    const r2 = await createReg(
      new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/registrations`, {
        method: "POST",
        body: JSON.stringify({
          categoryId: cat!.id,
          email: "amadou@journey.test",
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(r2.status).toBe(201);
    const created = (await r2.json()) as { registration: { id: string; status: string } };
    expect(created.registration.status).toBe("APPROVED");
    const regId = created.registration.id;

    // 3. Print badge
    const { POST: print } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/print/route"
    );
    const r3 = await print(
      new NextRequest(
        `http://localhost/api/admin/${org.id}/events/${event.id}/registrations/${regId}/print`,
        { method: "POST" },
      ),
      {
        params: Promise.resolve({ orgId: org.id, eventId: event.id, regId }),
      } as never,
    );
    expect(r3.status).toBe(200);
    expect(vi.mocked(sendBadgePrintedNotification)).toHaveBeenCalledWith(regId);

    // 4. Tous les logs portent orgId + eventId (critere d'acceptation #9)
    const logs = await prisma.activityLog.findMany({ where: { eventId: event.id } });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every((l) => l.orgId === org.id && l.eventId === event.id)).toBe(true);
    expect(logs.map((l) => l.type)).toEqual(
      expect.arrayContaining(["CATEGORY_CREATED", "REGISTRATION_CREATED", "BADGE_PRINTED"]),
    );
    // OWNER non-staff : aucun staffActor
    expect(logs.every((l) => !l.staffActor)).toBe(true);
  });
});

describe("OPERATOR restrictions (smoke)", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("OPERATOR can scan but cannot approve / PATCH / DELETE category (criteres #2, #10)", async () => {
    const op = await prisma.user.create({
      data: {
        email: "op@journey.test",
        password: "x",
        name: "Op",
        emailVerifiedAt: new Date(),
      },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-op-journey" } });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "E",
        slug: "e-op-journey",
        location: "L",
        date: new Date(),
      },
    });
    const cat = await prisma.category.create({
      data: { eventId: event.id, name: "V", color: "#000000", number: 1 },
    });
    await prisma.eventMembership.create({
      data: { userId: op.id, eventId: event.id, role: "OPERATOR" },
    });
    const scanParticipant = await prisma.user.create({
      data: {
        email: "scan-target@journey.test",
        password: "x",
        name: "Scan Target",
        emailVerifiedAt: new Date(),
      },
    });
    const reg = await prisma.registration.create({
      data: {
        id: "R-JOURNEY-OP",
        eventId: event.id,
        categoryId: cat.id,
        userId: scanParticipant.id,
        snapshotEmail: "scan-target@journey.test",
        snapshotLastName: "L",
        snapshotFirstName: "F",
        snapshotStructure: "S",
        snapshotPhoto: "uploads/test/photo.jpg",
        snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "D-OP-JOURNEY",
        snapshotIdDocument: "uploads/test/doc.pdf",
        status: "APPROVED",
      },
    });
    await withSession({ id: op.id, email: op.email, name: op.name, isStaff: false });

    // scan : autorise (OPERATOR a permission BADGE_SCAN)
    const { POST: scan } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/scan/verify/route"
    );
    const rscan = await scan(
      new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/scan/verify`, {
        method: "POST",
        body: JSON.stringify({ payload: reg.id }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(rscan.status).toBe(200);

    // approve : 403 (ADMIN minRole)
    const { POST: approve } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/approve/route"
    );
    const rapp = await approve(
      new NextRequest(
        `http://localhost/api/admin/${org.id}/events/${event.id}/registrations/${reg.id}/approve`,
        { method: "POST" },
      ),
      {
        params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: reg.id }),
      } as never,
    );
    expect(rapp.status).toBe(403);

    // PATCH registration : 403
    const { PATCH } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/registrations/[regId]/route"
    );
    const rpatch = await PATCH(
      new NextRequest(
        `http://localhost/api/admin/${org.id}/events/${event.id}/registrations/${reg.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ firstName: "X" }),
          headers: { "content-type": "application/json" },
        },
      ),
      {
        params: Promise.resolve({ orgId: org.id, eventId: event.id, regId: reg.id }),
      } as never,
    );
    expect(rpatch.status).toBe(403);

    // DELETE category : 403
    const { DELETE } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/categories/[id]/route"
    );
    const rdel = await DELETE(
      new NextRequest(
        `http://localhost/api/admin/${org.id}/events/${event.id}/categories/${cat.id}`,
        { method: "DELETE" },
      ),
      {
        params: Promise.resolve({ orgId: org.id, eventId: event.id, id: cat.id }),
      } as never,
    );
    expect(rdel.status).toBe(403);
  });
});

describe("Staff acting on event (smoke)", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("staff PATCH event sets staffActor=true on the log", async () => {
    const staff = await prisma.user.create({
      data: {
        email: "staff@journey.test",
        password: "x",
        name: "S",
        isStaff: true,
        staffRole: "STAFF_ADMIN",
        emailVerifiedAt: new Date(),
      },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o-staff-journey" } });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "E",
        slug: "e-staff-journey",
        location: "L",
        date: new Date(),
      },
    });
    await withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    const { PATCH } = await import("@/app/api/admin/[orgId]/events/[eventId]/route");
    const res = await PATCH(
      new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Renamed" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(200);

    const log = await prisma.activityLog.findFirst({
      where: { type: "EVENT_UPDATED", eventId: event.id },
    });
    expect(log?.staffActor).toBe(true);
  });
});
