import { makePng, putTestImage } from "@/test/factories-2a";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { __mailTesting, type ResolvedTransport } from "@/lib/mail";
import { enqueueEmail } from "@/lib/jobs/enqueue-email";
import { submitProfile } from "@/lib/profile-review";
import { notifyProfileDecision, notifyProfileSubmitted } from "../triggers";
import { makeParticipant, makeUser, sessionOf } from "./helpers";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return {
    ...actual,
    sendProfileApproved: vi.fn().mockResolvedValue(undefined),
    sendProfileRejected: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/jobs/enqueue-email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs/enqueue-email")>()),
  enqueueEmail: vi.fn(async () => undefined),
}));

beforeEach(() => {
  vi.mocked(getServerSession).mockReset();
  vi.mocked(enqueueEmail).mockClear();
  __mailTesting.setResolveTransporter(
    async () =>
      ({ transporter: {}, from: "x@y", contactEmail: "", contactPhone: "", settings: {} }) as unknown as ResolvedTransport,
  );
});
afterEach(() => __mailTesting.reset());

function put(body: unknown) {
  return new NextRequest("http://localhost/api/account/profile", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

async function putAs(user: { id: string; email: string; name: string }, body: unknown) {
  vi.mocked(getServerSession).mockResolvedValue(sessionOf({ ...user, isStaff: false }) as never);
  const { PUT } = await import("@/app/api/account/profile/route");
  return PUT(put(body));
}

async function seedStaff() {
  return {
    support: await makeUser({ staffRole: "STAFF_SUPPORT" }),
    admin: await makeUser({ staffRole: "STAFF_ADMIN" }),
    observer: await makeUser({ staffRole: "STAFF_OBSERVER" }),
  };
}

async function decide(kind: "approve" | "reject", staff: { id: string; email: string; name: string }, userId: string, body?: unknown) {
  vi.mocked(getServerSession).mockResolvedValue(sessionOf({ ...staff, isStaff: true }) as never);
  const route = await import(`@/app/api/platform/profiles/[userId]/${kind}/route`);
  return route.POST(
    new NextRequest("http://localhost/x", {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ userId }) },
  );
}

describe("déclencheurs profils", () => {
  it("déposer de nouvelles pièces notifie le staff STAFF_SUPPORT et au-dessus, avec email", async () => {
    const s = await seedStaff();
    const u = await makeParticipant({ profileStatus: "INCOMPLETE" });
    // La photo est desormais controlee (7:9, 210 x 270 min) : une vraie image est deposee.
    const photo = await putTestImage(`profile/${u.id}/photos/triggers.png`, makePng(420, 540), "image/png");
    const res = await putAs(u, { photo });
    expect(res.status).toBe(200);
    const rows = await prisma.notification.findMany({ where: { type: "PROFILE_SUBMITTED" } });
    expect(rows.map((r) => r.userId).sort()).toEqual([s.support.id, s.admin.id].sort());
    expect(rows[0]).toMatchObject({ scope: "PLATFORM", href: `/platform/profiles/${u.id}`, title: "Profil à valider" });
    expect(vi.mocked(enqueueEmail).mock.calls.map((c) => c[0].kind)).toEqual(
      Array(2).fill("notification.profile_submitted"),
    );
  });

  it("modifier seulement le prénom ne notifie pas le staff", async () => {
    await seedStaff();
    const u = await makeParticipant({ profileStatus: "INCOMPLETE" });
    await submitProfile(u.id);
    const res = await putAs(u, { firstName: "Alicia" });
    expect(res.status).toBe(200);
    expect(await prisma.notification.count()).toBe(0);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("un profil incomplet ne notifie pas le staff", async () => {
    await seedStaff();
    const u = await prisma.user.create({ data: { email: "inc@x.test", password: "x", name: "Inc" } });
    const res = await putAs(u, { firstName: "Alicia" });
    expect(res.status).toBe(200);
    expect(await prisma.notification.count()).toBe(0);
  });

  it("approuver un profil notifie le participant, sans email de notification", async () => {
    const s = await seedStaff();
    const u = await makeParticipant({ profileStatus: "INCOMPLETE" });
    await submitProfile(u.id);
    const res = await decide("approve", s.support, u.id);
    expect(res.status).toBe(200);
    const rows = await prisma.notification.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: u.id, type: "PROFILE_APPROVED", scope: "PARTICIPANT", href: "/account/profile" });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("rejeter un profil inclut le motif", async () => {
    const s = await seedStaff();
    const u = await makeParticipant({ profileStatus: "INCOMPLETE" });
    await submitProfile(u.id);
    const reason = await prisma.rejectionReason.create({ data: { label: "Document illisible", scope: "PROFILE" } });
    const res = await decide("reject", s.admin, u.id, { reasonId: reason.id });
    expect(res.status).toBe(200);
    const row = await prisma.notification.findFirstOrThrow({ where: { type: "PROFILE_REJECTED" } });
    expect(row.userId).toBe(u.id);
    expect(row.body).toContain("Motif : Document illisible");
    // Le staff qui décide n'est pas notifié.
    expect(await prisma.notification.count({ where: { userId: s.admin.id } })).toBe(0);
  });

  it("un rejet sans motif n'affiche pas « Motif : »", async () => {
    const staff = await makeUser({ staffRole: "STAFF_SUPPORT" });
    const u = await makeParticipant();
    await notifyProfileDecision(u.id, staff.id, "REJECTED");
    const row = await prisma.notification.findFirstOrThrow({ where: { type: "PROFILE_REJECTED" } });
    expect(row.body).not.toContain("Motif :");
  });

  it("utilisateur introuvable : aucun effet", async () => {
    await seedStaff();
    await notifyProfileSubmitted("inconnu");
    await notifyProfileDecision("inconnu", "staff", "APPROVED");
    expect(await prisma.notification.count()).toBe(0);
  });
});
