import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetRateLimitForTests } from "@/lib/rate-limit";
import { seedRecaptchaPlatform, clearRecaptchaPlatform } from "@/lib/__tests__/recaptcha-platform";
import { __mailTesting, type ResolvedTransport } from "@/lib/mail";
import { enqueueEmail } from "@/lib/jobs/enqueue-email";
import {
  notifyBadgePrinted,
  notifyRegistrationCreated,
  notifyRegistrationDecision,
  notifyRegistrationResubmitted,
} from "../triggers";
import { makeRegistration, seedTeam, sessionOf } from "./helpers";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/recaptcha", () => ({ verifyRecaptcha: vi.fn().mockResolvedValue({ ok: true }) }));

vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return {
    ...actual,
    sendRegistrationConfirmation: vi.fn().mockResolvedValue(undefined),
    sendRegistrationResubmitted: vi.fn().mockResolvedValue(undefined),
    sendStatusNotification: vi.fn().mockResolvedValue(undefined),
    sendBadgePrintedNotification: vi.fn().mockResolvedValue(undefined),
  };
});
import { sendStatusNotification } from "@/lib/mail";

vi.mock("@/lib/jobs/enqueue-email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs/enqueue-email")>()),
  enqueueEmail: vi.fn(async () => undefined),
}));

beforeEach(async () => {
  resetRateLimitForTests();
  vi.mocked(getServerSession).mockReset();
  vi.mocked(enqueueEmail).mockClear();
  vi.mocked(sendStatusNotification).mockClear();
  await seedRecaptchaPlatform();
  __mailTesting.setResolveTransporter(
    async () =>
      ({ transporter: {}, from: "x@y", contactEmail: "", contactPhone: "", settings: {} }) as unknown as ResolvedTransport,
  );
});
afterEach(() => __mailTesting.reset());
afterAll(clearRecaptchaPlatform);

type Team = Awaited<ReturnType<typeof seedTeam>>;

async function notifiedIds(type: string) {
  const rows = await prisma.notification.findMany({ where: { type: type as never } });
  return rows.map((r) => r.userId).sort();
}

async function postRegister(team: Team, as: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue(sessionOf(as) as never);
  const { POST } = await import("@/app/api/events/[slug]/register/route");
  return POST(
    new NextRequest(`http://localhost/api/events/${team.event.slug}/register`, {
      method: "POST",
      body: JSON.stringify({ categoryId: team.category.id }),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ slug: team.event.slug }) },
  );
}

function eventCtx(team: Team, regId: string) {
  return { params: Promise.resolve({ orgId: team.org.id, eventId: team.event.id, regId }) };
}

describe("déclencheurs inscriptions", () => {
  it("POST register notifie ADMIN et OPERATOR de l'évènement, OWNER d'org compris, pas le participant", async () => {
    const t = await seedTeam();
    const res = await postRegister(t, { ...t.participant, isStaff: false });
    expect(res.status).toBe(201);
    expect(await notifiedIds("REGISTRATION_CREATED")).toEqual([t.admin.id, t.operator.id, t.owner.id].sort());
    const kinds = vi.mocked(enqueueEmail).mock.calls.map((c) => c[0].kind);
    expect(kinds).toEqual(Array(3).fill("notification.registration_created"));
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: t.admin.id } });
    expect(row).toMatchObject({ scope: "EVENT", eventId: t.event.id, orgId: t.org.id, title: "Nouvelle inscription" });
    expect(row.body).toContain("Alice Doe");
    expect(row.body).toContain("Presse");
  });

  it("un OWNER d'org également ADMIN de l'évènement ne reçoit qu'une notification", async () => {
    const t = await seedTeam();
    await postRegister(t, { ...t.participant, isStaff: false });
    expect(await prisma.notification.count({ where: { userId: t.owner.id } })).toBe(1);
  });

  it("l'auteur d'une inscription n'est pas notifié de sa propre action", async () => {
    const t = await seedTeam();
    // L'admin dispose d'un profil complet et s'inscrit lui-même.
    await prisma.user.update({
      where: { id: t.admin.id },
      data: {
        firstName: "Ad", lastName: "Min", structure: "S", photo: "/p", idDocumentType: "CNI",
        idDocumentNumber: "ZZ1", idDocument: "/d", participantProfileCompletedAt: new Date(), profileStatus: "APPROVED",
      },
    });
    const res = await postRegister(t, { ...t.admin, isStaff: false });
    expect(res.status).toBe(201);
    expect(await notifiedIds("REGISTRATION_CREATED")).toEqual([t.operator.id, t.owner.id].sort());
  });

  it("POST resubmit notifie l'équipe de l'évènement", async () => {
    const t = await seedTeam();
    const reg = await makeRegistration(
      { eventId: t.event.id, categoryId: t.category.id, user: t.participant },
      { status: "REJECTED", rejectionReason: "Photo" },
    );
    vi.mocked(getServerSession).mockResolvedValue(sessionOf({ ...t.participant, isStaff: false }) as never);
    const { POST } = await import("@/app/api/account/registrations/[id]/resubmit/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/account/registrations/${reg.id}/resubmit`, { method: "POST" }),
      { params: Promise.resolve({ id: reg.id }) },
    );
    expect(res.status).toBe(200);
    expect(await notifiedIds("REGISTRATION_RESUBMITTED")).toEqual([t.admin.id, t.operator.id, t.owner.id].sort());
  });

  it("approve notifie le participant sans email de notification", async () => {
    const t = await seedTeam();
    const reg = await makeRegistration({ eventId: t.event.id, categoryId: t.category.id, user: t.participant });
    vi.mocked(getServerSession).mockResolvedValue(sessionOf({ ...t.operator, isStaff: false }) as never);
    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/approve/route");
    const res = await POST(
      new NextRequest("http://localhost/x", { method: "POST" }),
      eventCtx(t, reg.id),
    );
    expect(res.status).toBe(200);
    const rows = await prisma.notification.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: t.participant.id, type: "REGISTRATION_APPROVED", scope: "PARTICIPANT",
      eventId: t.event.id, href: `/account/registrations/${reg.id}`,
    });
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(sendStatusNotification).toHaveBeenCalledTimes(1);
    // L'opérateur qui approuve n'est pas notifié.
    expect(await prisma.notification.count({ where: { userId: t.operator.id } })).toBe(0);
  });

  it("reject inclut le motif dans le corps", async () => {
    const t = await seedTeam();
    const reg = await makeRegistration({ eventId: t.event.id, categoryId: t.category.id, user: t.participant });
    const reason = await prisma.rejectionReason.create({ data: { label: "Photo floue", scope: "REGISTRATION" } });
    vi.mocked(getServerSession).mockResolvedValue(sessionOf({ ...t.operator, isStaff: false }) as never);
    const { POST } = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/reject/route");
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ reasonId: reason.id }),
        headers: { "content-type": "application/json" },
      }),
      eventCtx(t, reg.id),
    );
    expect(res.status).toBe(200);
    const row = await prisma.notification.findFirstOrThrow({ where: { type: "REGISTRATION_REJECTED" } });
    expect(row.userId).toBe(t.participant.id);
    expect(row.body).toContain("Motif : Photo floue");
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("print et print en lot notifient chaque participant une fois", async () => {
    const t = await seedTeam();
    const reg = await makeRegistration({ eventId: t.event.id, categoryId: t.category.id, user: t.participant }, { status: "APPROVED" });
    vi.mocked(getServerSession).mockResolvedValue(sessionOf({ ...t.printer, isStaff: false }) as never);
    const single = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/[regId]/print/route");
    expect((await single.POST(new NextRequest("http://localhost/x", { method: "POST" }), eventCtx(t, reg.id))).status).toBe(200);
    expect(await prisma.notification.count({ where: { type: "BADGE_PRINTED", userId: t.participant.id } })).toBe(1);

    const other = await seedTeamParticipant(t);
    const batch = await import("@/app/api/org/[orgId]/events/[eventId]/registrations/print/route");
    const res = await batch.POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({ ids: [other.reg.id] }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: t.org.id, eventId: t.event.id }) } as never,
    );
    expect(res.status).toBe(200);
    expect(await prisma.notification.count({ where: { type: "BADGE_PRINTED", userId: other.user.id } })).toBe(1);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("inscription introuvable : le déclencheur ne crée rien et ne lève pas", async () => {
    const t = await seedTeam();
    await notifyRegistrationCreated("inconnue", t.admin.id);
    await notifyRegistrationResubmitted("inconnue", t.admin.id);
    await notifyRegistrationDecision("inconnue", t.admin.id, "APPROVED");
    await notifyBadgePrinted(["inconnue"], t.admin.id);
    expect(await prisma.notification.count()).toBe(0);
  });

  it("une erreur dans le déclencheur est avalée", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi.spyOn(prisma.registration, "findUnique").mockRejectedValue(new Error("db"));
    await notifyRegistrationCreated("x", "y");
    spy.mockRestore();
    expect(err).toHaveBeenCalledWith("[notify] trigger failed", expect.objectContaining({ label: "registration-created" }));
    err.mockRestore();
  });

  it("une resoumission avec changement de catégorie le mentionne", async () => {
    const t = await seedTeam();
    const reg = await makeRegistration({ eventId: t.event.id, categoryId: t.category.id, user: t.participant });
    await notifyRegistrationResubmitted(reg.id, t.participant.id, { categoryChanged: { from: "Presse", to: "Exposant" } });
    const row = await prisma.notification.findFirstOrThrow({ where: { userId: t.admin.id } });
    expect(row.body).toContain("Exposant");
  });
});

async function seedTeamParticipant(t: Team) {
  const { makeParticipant } = await import("./helpers");
  const user = await makeParticipant();
  const reg = await makeRegistration({ eventId: t.event.id, categoryId: t.category.id, user }, { status: "APPROVED" });
  return { user, reg };
}
