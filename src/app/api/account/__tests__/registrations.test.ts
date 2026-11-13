import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return {
    ...actual,
    sendAccountVerifyEmail: vi.fn(),
    sendAccountPasswordReset: vi.fn(),
    sendRegistrationConfirmation: vi.fn(),
    sendRegistrationResubmitted: vi.fn(),
    sendStatusNotification: vi.fn(),
    sendBadgePrintedNotification: vi.fn(),
  };
});

import { sendRegistrationResubmitted } from "@/lib/mail";

vi.mock("@/lib/generate-id", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/generate-id")>();
  return { ...actual, generateId: vi.fn(actual.generateId) };
});
import { generateId } from "@/lib/generate-id";
import { extractDiff } from "@/lib/activity-labels";

async function withSession(user: {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
}) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

// Par defaut l'organisation a un abonnement ACTIF : la garde de resoumission ne depend pas
// de la date (en dur) de l'evenement. `withSubscription: false` laisse le test en creer un.
async function seedEventBundle(slug: string, opts: { withSubscription?: boolean } = {}) {
  const org = await prisma.organization.create({
    data: { name: "Org", slug: `org-${slug}` },
  });
  if (opts.withSubscription !== false) {
    const plan = await prisma.plan.create({
      data: { name: `plan-seed-${slug}`, maxEvents: null, maxParticipantsPerEvent: null },
    });
    await prisma.subscription.create({
      data: { orgId: org.id, planId: plan.id, status: "ACTIVE", endDate: new Date(Date.now() + 365 * 86_400_000) },
    });
  }
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Event",
      slug,
      location: "L",
      date: new Date("2026-12-15"),
      registrationOpen: true,
    },
  });
  const category = await prisma.category.create({
    data: { eventId: event.id, name: "Cat", color: "#000000", number: 1 },
  });
  return { org, event, category };
}

const COMPLETE_PROFILE = {
  firstName: "Alice",
  lastName: "Doe",
  structure: "ACME",
  photo: "/uploads/photo.png",
  idDocumentType: "CNI",
  idDocumentNumber: "AB1234",
  idDocument: "/uploads/doc.pdf",
};

async function createCompleteUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      password: "x",
      name: "User",
      emailVerifiedAt: new Date(),
      ...COMPLETE_PROFILE,
      participantProfileCompletedAt: new Date(),
      // v4 (plan 08) : la resoumission exige aussi un profil approuve.
      profileStatus: "APPROVED",
    },
  });
}

async function createRegistration(args: {
  id: string;
  userId: string;
  eventId: string;
  categoryId: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  email: string;
}) {
  return prisma.registration.create({
    data: {
      id: args.id,
      userId: args.userId,
      eventId: args.eventId,
      categoryId: args.categoryId,
      status: args.status ?? "PENDING",
      snapshotFirstName: "Alice",
      snapshotLastName: "Doe",
      snapshotEmail: args.email,
      snapshotStructure: "ACME",
      snapshotPhoto: "/uploads/photo.png",
      snapshotIdDocumentType: "CNI",
      snapshotIdDocumentNumber: "AB1234",
      snapshotIdDocument: "/uploads/doc.pdf",
    },
  });
}

describe("GET /api/account/registrations", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { GET } = await import("@/app/api/account/registrations/route");
    const res = await GET(new NextRequest("http://localhost/api/account/registrations"));
    expect(res.status).toBe(401);
  });

  it("returns only the registrations owned by the current user", async () => {
    const me = await createCompleteUser("me@v2-11-acctreg.test");
    const other = await createCompleteUser("other@v2-11-acctreg.test");
    const { event, category } = await seedEventBundle("acctreg-list");
    await createRegistration({
      id: "REG-A",
      userId: me.id,
      eventId: event.id,
      categoryId: category.id,
      email: me.email,
    });
    await createRegistration({
      id: "REG-B",
      userId: other.id,
      eventId: event.id,
      categoryId: category.id,
      email: other.email,
    });
    await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });

    const { GET } = await import("@/app/api/account/registrations/route");
    const res = await GET(new NextRequest("http://localhost/api/account/registrations"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.registrations).toHaveLength(1);
    expect(json.registrations[0].id).toBe("REG-A");
  });

  describe("unexpected prisma failure", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("rethrows a non-AuthError raised while loading registrations", async () => {
      const me = await createCompleteUser("me@v2-11-acctreg-rethrow.test");
      await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });
      vi.spyOn(prisma.registration, "findMany").mockRejectedValueOnce(
        new Error("boom-registrations-list"),
      );

      const { GET } = await import("@/app/api/account/registrations/route");
      await expect(
        GET(new NextRequest("http://localhost/api/account/registrations")),
      ).rejects.toThrow("boom-registrations-list");
    });
  });
});

describe("GET /api/account/registrations/[id]", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { GET } = await import("@/app/api/account/registrations/[id]/route");
    const res = await GET(
      new NextRequest("http://localhost/api/account/registrations/whatever"),
      { params: Promise.resolve({ id: "whatever" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when the registration does not exist", async () => {
    const me = await createCompleteUser("me@v2-11-acctreg-detail-404.test");
    await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });

    const { GET } = await import("@/app/api/account/registrations/[id]/route");
    const res = await GET(
      new NextRequest("http://localhost/api/account/registrations/does-not-exist"),
      { params: Promise.resolve({ id: "does-not-exist" }) },
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe("NOT_FOUND");
  });

  describe("unexpected prisma failure", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("rethrows a non-AuthError raised while loading the registration", async () => {
      const me = await createCompleteUser("me@v2-11-acctreg-detail-rethrow.test");
      await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });
      vi.spyOn(prisma.registration, "findUnique").mockRejectedValueOnce(
        new Error("boom-registration-detail"),
      );

      const { GET } = await import("@/app/api/account/registrations/[id]/route");
      await expect(
        GET(new NextRequest("http://localhost/api/account/registrations/REG-X"), {
          params: Promise.resolve({ id: "REG-X" }),
        }),
      ).rejects.toThrow("boom-registration-detail");
    });
  });

  it("returns 403 when the registration belongs to another user", async () => {
    const me = await createCompleteUser("me@v2-11-acctreg-detail.test");
    const other = await createCompleteUser("other@v2-11-acctreg-detail.test");
    const { event, category } = await seedEventBundle("acctreg-detail");
    const reg = await createRegistration({
      id: "REG-OTHER",
      userId: other.id,
      eventId: event.id,
      categoryId: category.id,
      email: other.email,
    });
    await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });

    const { GET } = await import("@/app/api/account/registrations/[id]/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/account/registrations/${reg.id}`),
      { params: Promise.resolve({ id: reg.id }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with the registration when owner", async () => {
    const me = await createCompleteUser("me@v2-11-acctreg-detail-ok.test");
    const { event, category } = await seedEventBundle("acctreg-detail-ok");
    const reg = await createRegistration({
      id: "REG-MINE",
      userId: me.id,
      eventId: event.id,
      categoryId: category.id,
      email: me.email,
    });
    await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });

    const { GET } = await import("@/app/api/account/registrations/[id]/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/account/registrations/${reg.id}`),
      { params: Promise.resolve({ id: reg.id }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.registration.id).toBe("REG-MINE");
    expect(json.registration.snapshotFirstName).toBe("Alice");
  });
});

describe("POST /api/account/registrations/[id]/resubmit", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
    vi.mocked(sendRegistrationResubmitted).mockClear();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { POST } = await import(
      "@/app/api/account/registrations/[id]/resubmit/route"
    );
    const res = await POST(
      new NextRequest("http://localhost/api/account/registrations/X/resubmit", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "X" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 409 when status is not REJECTED", async () => {
    const me = await createCompleteUser("me@v2-11-acctreg-resub.test");
    const { event, category } = await seedEventBundle("acctreg-resub-pending");
    const reg = await createRegistration({
      id: "REG-PENDING",
      userId: me.id,
      eventId: event.id,
      categoryId: category.id,
      status: "PENDING",
      email: me.email,
    });
    await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });

    const { POST } = await import(
      "@/app/api/account/registrations/[id]/resubmit/route"
    );
    const res = await POST(
      new NextRequest(`http://localhost/api/account/registrations/${reg.id}/resubmit`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: reg.id }) },
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("INVALID_STATE");
  });

  it("returns 404 when the registration does not exist", async () => {
    const me = await createCompleteUser("me@v2-11-acctreg-resub-404.test");
    await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });

    const { POST } = await import(
      "@/app/api/account/registrations/[id]/resubmit/route"
    );
    const res = await POST(
      new NextRequest("http://localhost/api/account/registrations/does-not-exist/resubmit", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "does-not-exist" }) },
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe("NOT_FOUND");
  });

  it("returns 400 PROFILE_INCOMPLETE when the participant profile is not complete", async () => {
    const me = await prisma.user.create({
      data: {
        email: "incomplete@v2-11-acctreg-resub.test",
        password: "x",
        name: "Incomplete",
        // Profil volontairement incomplet : firstName/lastName/structure/etc. manquants.
      },
    });
    const { event, category } = await seedEventBundle("acctreg-resub-incomplete");
    const reg = await createRegistration({
      id: "REG-INCOMPLETE",
      userId: me.id,
      eventId: event.id,
      categoryId: category.id,
      status: "REJECTED",
      email: me.email,
    });
    await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });

    const { POST } = await import(
      "@/app/api/account/registrations/[id]/resubmit/route"
    );
    const res = await POST(
      new NextRequest(`http://localhost/api/account/registrations/${reg.id}/resubmit`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: reg.id }) },
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("PROFILE_INCOMPLETE");

    // La registration reste inchangee (toujours REJECTED).
    const untouched = await prisma.registration.findUnique({ where: { id: reg.id } });
    expect(untouched?.status).toBe("REJECTED");
  });

  describe("garde d'abonnement a la resoumission", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    async function setupRejected(slug: string, eventDate: Date, maxParticipantsPerEvent: number | null) {
      const me = await createCompleteUser(`${slug}@v2-11-acctreg-resub.test`);
      const { org, event, category } = await seedEventBundle(slug, { withSubscription: false });
      await prisma.event.update({ where: { id: event.id }, data: { date: eventDate } });
      const plan = await prisma.plan.create({
        data: { name: `plan-${slug}`, maxEvents: null, maxParticipantsPerEvent },
      });
      // Abonnement echu : droits « inactif » (RECEIVE_REGISTRATIONS valable si evenement en cours).
      await prisma.subscription.create({
        data: { orgId: org.id, planId: plan.id, status: "EXPIRED", endDate: new Date(Date.now() - 86_400_000) },
      });
      const reg = await createRegistration({
        id: `REG-${slug}`,
        userId: me.id,
        eventId: event.id,
        categoryId: category.id,
        status: "REJECTED",
        email: me.email,
      });
      await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });
      return { me, event, category, reg };
    }

    async function callResubmit(id: string) {
      const { POST } = await import("@/app/api/account/registrations/[id]/resubmit/route");
      return POST(
        new NextRequest(`http://localhost/api/account/registrations/${id}/resubmit`, { method: "POST" }),
        { params: Promise.resolve({ id }) },
      );
    }

    it("returns 403 SUBSCRIPTION_INACTIVE when expired and the event is over", async () => {
      const { reg } = await setupRejected("acctreg-resub-over", new Date("2020-01-01"), null);
      const res = await callResubmit(reg.id);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("SUBSCRIPTION_INACTIVE");
      expect(json.error).toBe("Inscriptions fermées.");
      const untouched = await prisma.registration.findUnique({ where: { id: reg.id } });
      expect(untouched?.status).toBe("REJECTED");
    });

    it("resubmits when expired but the event is still ongoing", async () => {
      const { reg } = await setupRejected("acctreg-resub-ongoing", new Date(Date.now() + 86_400_000), null);
      const res = await callResubmit(reg.id);
      expect(res.status).toBe(200);
      const updated = await prisma.registration.findUnique({ where: { id: reg.id } });
      expect(updated?.status).toBe("PENDING");
    });

    it("returns 429 PARTICIPANT_LIMIT when the event is full (the rejected registration is not counted)", async () => {
      const { reg, event, category } = await setupRejected(
        "acctreg-resub-full",
        new Date(Date.now() + 86_400_000),
        1,
      );
      const other = await createCompleteUser("other@v2-11-acctreg-resub.test");
      await createRegistration({
        id: "REG-acctreg-resub-full-other",
        userId: other.id,
        eventId: event.id,
        categoryId: category.id,
        status: "PENDING",
        email: other.email,
      });
      const res = await callResubmit(reg.id);
      expect(res.status).toBe(429);
      const json = await res.json();
      expect(json.code).toBe("PARTICIPANT_LIMIT");
      expect(json.error).toBe("Inscriptions complètes.");
    });

    it("rethrows an unexpected error raised by the subscription check", async () => {
      const { reg } = await setupRejected("acctreg-resub-boom", new Date(Date.now() + 86_400_000), null);
      const original = prisma.event.findUnique.bind(prisma.event);
      const spy = vi.spyOn(prisma.event, "findUnique");
      spy.mockImplementation(((args: never) => {
        const a = args as { select?: { orgId?: boolean; archived?: boolean } };
        if (a.select?.archived) return Promise.reject(new Error("boom-subscription"));
        return original(args);
      }) as never);
      await expect(callResubmit(reg.id)).rejects.toThrow("boom-subscription");
    });
  });

  describe("unexpected prisma / defensive failures", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("returns 404 NOT_FOUND if the owning user disappears between the ownership check and the profile lookup", async () => {
      // Cas normalement impossible en base reelle : Registration.userId est une FK
      // `onDelete: Restrict` vers User, donc un user avec une registration ne peut
      // jamais etre supprime. On simule cette incoherence via un spy cible sur
      // prisma.user.findUnique (meme technique que src/lib/__tests__/auth.test.ts et
      // src/lib/__tests__/slugify-event.test.ts) pour couvrir la branche defensive
      // `if (!user)` (route.ts l.47-48) qu'aucun flux reel ne peut atteindre.
      const me = await createCompleteUser("me@v2-11-acctreg-resub-ghost.test");
      const { event, category } = await seedEventBundle("acctreg-resub-ghost");
      const reg = await createRegistration({
        id: "REG-GHOST-USER",
        userId: me.id,
        eventId: event.id,
        categoryId: category.id,
        status: "REJECTED",
        email: me.email,
      });
      await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });
      // L'utilisateur de session existe pour le garde ; seule la relecture du profil le perd.
      const realFindUnique = prisma.user.findUnique.bind(prisma.user);
      vi.spyOn(prisma.user, "findUnique").mockImplementation(((args: { select?: Record<string, unknown> }) =>
        args?.select && !("id" in args.select) && "firstName" in args.select
          ? Promise.resolve(null)
          : realFindUnique(args as never)) as never);

      const { POST } = await import(
        "@/app/api/account/registrations/[id]/resubmit/route"
      );
      const res = await POST(
        new NextRequest(`http://localhost/api/account/registrations/${reg.id}/resubmit`, {
          method: "POST",
        }),
        { params: Promise.resolve({ id: reg.id }) },
      );
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.code).toBe("NOT_FOUND");
    });

    it("rethrows a non-AuthError raised while persisting the resubmission", async () => {
      const me = await createCompleteUser("me@v2-11-acctreg-resub-rethrow.test");
      const { event, category } = await seedEventBundle("acctreg-resub-rethrow");
      const reg = await createRegistration({
        id: "REG-RETHROW",
        userId: me.id,
        eventId: event.id,
        categoryId: category.id,
        status: "REJECTED",
        email: me.email,
      });
      await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });
      vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("boom-resubmit"));

      const { POST } = await import(
        "@/app/api/account/registrations/[id]/resubmit/route"
      );
      await expect(
        POST(
          new NextRequest(`http://localhost/api/account/registrations/${reg.id}/resubmit`, {
            method: "POST",
          }),
          { params: Promise.resolve({ id: reg.id }) },
        ),
      ).rejects.toThrow("boom-resubmit");
    });
  });

  it("returns 403 when the registration belongs to another user", async () => {
    const me = await createCompleteUser("me@v2-11-acctreg-resub-forbid.test");
    const other = await createCompleteUser("other@v2-11-acctreg-resub-forbid.test");
    const { event, category } = await seedEventBundle("acctreg-resub-forbid");
    const reg = await createRegistration({
      id: "REG-NOT-MINE",
      userId: other.id,
      eventId: event.id,
      categoryId: category.id,
      status: "REJECTED",
      email: other.email,
    });
    await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });

    const { POST } = await import(
      "@/app/api/account/registrations/[id]/resubmit/route"
    );
    const res = await POST(
      new NextRequest(`http://localhost/api/account/registrations/${reg.id}/resubmit`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: reg.id }) },
    );
    expect(res.status).toBe(403);
  });

  it("refuse la resoumission si les pieces ont ete rejetees (403 PROFILE_NOT_SUBMITTED)", async () => {
    const me = await createCompleteUser("me@v2-11-acctreg-resub-gate.test");
    await prisma.user.update({ where: { id: me.id }, data: { profileStatus: "REJECTED" } });
    const { event, category } = await seedEventBundle("acctreg-resub-gate");
    const reg = await createRegistration({
      id: "REG-GATE",
      userId: me.id,
      eventId: event.id,
      categoryId: category.id,
      status: "REJECTED",
      email: me.email,
    });
    await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });

    const { POST } = await import("@/app/api/account/registrations/[id]/resubmit/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/account/registrations/${reg.id}/resubmit`, { method: "POST" }),
      { params: Promise.resolve({ id: reg.id }) },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PROFILE_NOT_SUBMITTED");
    expect((await prisma.registration.findUnique({ where: { id: reg.id } }))?.status).toBe("REJECTED");
  });

  it("success: updates snapshot from user profile, sets PENDING, sends mail, logs", async () => {
    const me = await createCompleteUser("me@v2-11-acctreg-resub-ok.test");
    const { event, category } = await seedEventBundle("acctreg-resub-ok");
    const reg = await createRegistration({
      id: "REG-REJECTED",
      userId: me.id,
      eventId: event.id,
      categoryId: category.id,
      status: "REJECTED",
      email: "OLD@v2-11-acctreg-resub-ok.test",
    });
    // Mutate snapshot to verify it's overwritten
    await prisma.registration.update({
      where: { id: reg.id },
      data: {
        snapshotFirstName: "Old",
        snapshotLastName: "Stale",
        rejectionReason: "wrong photo",
        rejectionDetails: "details",
      },
    });
    // Update user profile so snapshot diverges
    await prisma.user.update({
      where: { id: me.id },
      data: { firstName: "Charlie", lastName: "New" },
    });

    await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });

    const { POST } = await import(
      "@/app/api/account/registrations/[id]/resubmit/route"
    );
    const res = await POST(
      new NextRequest(`http://localhost/api/account/registrations/${reg.id}/resubmit`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: reg.id }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(reg.id);

    const updated = await prisma.registration.findUnique({ where: { id: reg.id } });
    expect(updated?.status).toBe("PENDING");
    expect(updated?.snapshotFirstName).toBe("Charlie");
    expect(updated?.snapshotLastName).toBe("New");
    expect(updated?.snapshotEmail).toBe(me.email);
    expect(updated?.rejectionReason).toBeNull();
    expect(updated?.rejectionDetails).toBeNull();

    expect(vi.mocked(sendRegistrationResubmitted)).toHaveBeenCalledWith(reg.id);

    const log = await prisma.activityLog.findFirst({
      where: { type: "REGISTRATION_RESUBMITTED", targetId: reg.id },
    });
    expect(log).not.toBeNull();
  });
});


describe("POST /api/account/registrations/[id]/resubmit - changement de categorie", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
    vi.mocked(sendRegistrationResubmitted).mockClear();
  });

  afterEach(() => {
    vi.mocked(generateId).mockReset();
  });

  async function loadRoute() {
    return import("@/app/api/account/registrations/[id]/resubmit/route");
  }

  function post(id: string, body?: string) {
    return new NextRequest(`http://localhost/api/account/registrations/${id}/resubmit`, {
      method: "POST",
      ...(body === undefined
        ? {}
        : { body, headers: { "content-type": "application/json" } }),
    });
  }

  async function seedRejected(slug: string) {
    const me = await createCompleteUser(`me@${slug}.test`);
    const { event, category: presse } = await seedEventBundle(slug);
    await prisma.category.update({ where: { id: presse.id }, data: { name: "Presse" } });
    const exposant = await prisma.category.create({
      data: { eventId: event.id, name: "Exposant", color: "#ff0000", number: 2 },
    });
    const reg = await createRegistration({
      id: `REG-${slug}`,
      userId: me.id,
      eventId: event.id,
      categoryId: presse.id,
      status: "REJECTED",
      email: me.email,
    });
    await withSession({ id: me.id, email: me.email, name: me.name, isStaff: false });
    return { me, event, presse, exposant, reg };
  }

  it("returns 400 INVALID_CATEGORY for a category of another event, without changes", async () => {
    const { reg, presse } = await seedRejected("catchg-other");
    const other = await seedEventBundle("catchg-other-evt");

    const { POST } = await loadRoute();
    const res = await POST(post(reg.id, JSON.stringify({ categoryId: other.category.id })), {
      params: Promise.resolve({ id: reg.id }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_CATEGORY");

    const untouched = await prisma.registration.findUnique({ where: { id: reg.id } });
    expect(untouched?.categoryId).toBe(presse.id);
    expect(untouched?.status).toBe("REJECTED");
    expect(vi.mocked(sendRegistrationResubmitted)).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_CATEGORY when the target category was deleted", async () => {
    const { reg, event, presse } = await seedRejected("catchg-deleted");
    const gone = await prisma.category.create({
      data: { eventId: event.id, name: "Gone", color: "#00ff00", number: 3 },
    });
    await prisma.category.delete({ where: { id: gone.id } });

    const { POST } = await loadRoute();
    const res = await POST(post(reg.id, JSON.stringify({ categoryId: gone.id })), {
      params: Promise.resolve({ id: reg.id }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_CATEGORY");

    const untouched = await prisma.registration.findUnique({ where: { id: reg.id } });
    expect(untouched?.categoryId).toBe(presse.id);
    expect(untouched?.status).toBe("REJECTED");
  });

  it("returns 400 INVALID_BODY on malformed JSON", async () => {
    const { reg } = await seedRejected("catchg-badjson");
    const { POST } = await loadRoute();
    const res = await POST(post(reg.id, "{"), { params: Promise.resolve({ id: reg.id }) });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_BODY");
    expect((await prisma.registration.findUnique({ where: { id: reg.id } }))?.status).toBe("REJECTED");
  });

  it("returns 400 INVALID_BODY when categoryId is not a non-empty string", async () => {
    const { reg } = await seedRejected("catchg-badtype");
    const { POST } = await loadRoute();
    for (const body of [{ categoryId: 42 }, { categoryId: "" }]) {
      const res = await POST(post(reg.id, JSON.stringify(body)), {
        params: Promise.resolve({ id: reg.id }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("INVALID_BODY");
    }
  });

  it("accepts an empty body and an empty object", async () => {
    const { reg, presse, event } = await seedRejected("catchg-empty");
    const { POST } = await loadRoute();
    const res1 = await POST(post(reg.id, ""), { params: Promise.resolve({ id: reg.id }) });
    expect(res1.status).toBe(200);

    // Une inscription par (participant, evenement) : la seconde passe par un autre participant.
    const second = await createCompleteUser("second@catchg-empty.test");
    const reg2 = await createRegistration({
      id: "REG-catchg-empty-2",
      userId: second.id,
      eventId: event.id,
      categoryId: presse.id,
      status: "REJECTED",
      email: second.email,
    });
    await withSession({ id: second.id, email: second.email, name: second.name, isStaff: false });
    const res2 = await POST(post(reg2.id, "{}"), { params: Promise.resolve({ id: reg2.id }) });
    expect(res2.status).toBe(200);
    expect((await res2.json()).id).toBe(reg2.id);
    expect((await prisma.registration.findUnique({ where: { id: reg2.id } }))?.categoryId).toBe(presse.id);
  });

  it("returns 409 INVALID_STATE for a PENDING registration even with a categoryId", async () => {
    const { reg, exposant, presse } = await seedRejected("catchg-pending");
    await prisma.registration.update({ where: { id: reg.id }, data: { status: "PENDING" } });

    const { POST } = await loadRoute();
    const res = await POST(post(reg.id, JSON.stringify({ categoryId: exposant.id })), {
      params: Promise.resolve({ id: reg.id }),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("INVALID_STATE");
    expect((await prisma.registration.findUnique({ where: { id: reg.id } }))?.categoryId).toBe(presse.id);
  });

  it("changes the category, regenerates the id and sets PENDING in the new category", async () => {
    const { reg, exposant, me } = await seedRejected("catchg-ok");
    await prisma.registration.update({
      where: { id: reg.id },
      data: { snapshotFirstName: "Old", rejectionReason: "r", rejectionDetails: "d" },
    });

    const { POST } = await loadRoute();
    const res = await POST(post(reg.id, JSON.stringify({ categoryId: exposant.id })), {
      params: Promise.resolve({ id: reg.id }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).not.toBe(reg.id);
    expect(json.id[0]).toBe("2");
    expect(json.id[9]).toBe("2");

    expect(await prisma.registration.findUnique({ where: { id: reg.id } })).toBeNull();
    const moved = await prisma.registration.findUnique({ where: { id: json.id } });
    expect(moved?.status).toBe("PENDING");
    expect(moved?.categoryId).toBe(exposant.id);
    expect(moved?.rejectionReason).toBeNull();
    expect(moved?.snapshotFirstName).toBe(me.firstName);
  });

  it("logs old and new category and ids in details", async () => {
    const { reg, exposant, presse } = await seedRejected("catchg-log");
    const { POST } = await loadRoute();
    const res = await POST(post(reg.id, JSON.stringify({ categoryId: exposant.id })), {
      params: Promise.resolve({ id: reg.id }),
    });
    const json = await res.json();

    const log = await prisma.activityLog.findFirst({
      where: { type: "REGISTRATION_RESUBMITTED", targetId: json.id },
    });
    expect(log).not.toBeNull();
    const details = log?.details as Record<string, unknown>;
    expect(details.categoryChanged).toEqual({
      from: { id: presse.id, name: "Presse" },
      to: { id: exposant.id, name: "Exposant" },
    });
    expect(details.idChanged).toEqual({ from: reg.id, to: json.id });
    expect(extractDiff(details)).toContainEqual({ field: "Catégorie", from: "Presse", to: "Exposant" });
  });

  it("sends the resubmitted mail with the new id and the previous category", async () => {
    const { reg, exposant } = await seedRejected("catchg-mail");
    const { POST } = await loadRoute();
    const res = await POST(post(reg.id, JSON.stringify({ categoryId: exposant.id })), {
      params: Promise.resolve({ id: reg.id }),
    });
    const json = await res.json();
    expect(vi.mocked(sendRegistrationResubmitted)).toHaveBeenCalledWith(json.id, {
      previousCategoryName: "Presse",
    });
  });

  it("keeps the id and logs no details when categoryId equals the current category", async () => {
    const { reg, presse } = await seedRejected("catchg-same");
    const { POST } = await loadRoute();
    const res = await POST(post(reg.id, JSON.stringify({ categoryId: presse.id })), {
      params: Promise.resolve({ id: reg.id }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(reg.id);
    expect(vi.mocked(sendRegistrationResubmitted)).toHaveBeenCalledWith(reg.id);
    const log = await prisma.activityLog.findFirst({
      where: { type: "REGISTRATION_RESUBMITTED", targetId: reg.id },
    });
    expect(log).not.toBeNull();
    expect(log?.details).toBeNull();
  });

  it("concurrent resubmissions: one succeeds, the other gets 409", async () => {
    const { reg, exposant, me, event } = await seedRejected("catchg-race");
    const { POST } = await loadRoute();
    const call = () =>
      POST(post(reg.id, JSON.stringify({ categoryId: exposant.id })), {
        params: Promise.resolve({ id: reg.id }),
      });
    const results = await Promise.all([call(), call()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.registration.count({ where: { userId: me.id, eventId: event.id } })).toBe(1);
    expect(
      await prisma.activityLog.count({ where: { type: "REGISTRATION_RESUBMITTED", eventId: event.id } }),
    ).toBe(1);
    expect(vi.mocked(sendRegistrationResubmitted)).toHaveBeenCalledTimes(1);
  });

  it("rolls back and rethrows when every generated id collides", async () => {
    const { reg, exposant, presse, event } = await seedRejected("catchg-collide");
    const other = await createCompleteUser("other@catchg-collide.test");
    await createRegistration({
      id: "TAKEN-ID",
      userId: other.id,
      eventId: event.id,
      categoryId: exposant.id,
      email: other.email,
    });
    vi.mocked(generateId).mockReturnValue("TAKEN-ID");
    await prisma.registration.update({ where: { id: reg.id }, data: { snapshotFirstName: "Old" } });

    const { POST } = await loadRoute();
    await expect(
      POST(post(reg.id, JSON.stringify({ categoryId: exposant.id })), {
        params: Promise.resolve({ id: reg.id }),
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const untouched = await prisma.registration.findUnique({ where: { id: reg.id } });
    expect(untouched?.status).toBe("REJECTED");
    expect(untouched?.categoryId).toBe(presse.id);
    expect(untouched?.snapshotFirstName).toBe("Old");
    expect(vi.mocked(sendRegistrationResubmitted)).not.toHaveBeenCalled();
    expect(await prisma.activityLog.count({ where: { type: "REGISTRATION_RESUBMITTED" } })).toBe(0);
  });

  async function seedTeamAdmin(eventId: string) {
    const admin = await prisma.user.create({
      data: { email: `admin-${eventId}@x.test`, password: "x", name: "Admin" },
    });
    await prisma.eventMembership.create({ data: { userId: admin.id, eventId, role: "ADMIN" } });
    return admin;
  }

  it("un changement de catégorie réécrit les liens des notifications existantes vers le nouvel ID", async () => {
    const { reg, exposant, event } = await seedRejected("catchg-notif-links");
    const admin = await seedTeamAdmin(event.id);
    const href = `/event/${event.id}/registrations/${reg.id}`;
    const old = await prisma.notification.create({
      data: {
        userId: admin.id, type: "REGISTRATION_CREATED", scope: "EVENT", eventId: event.id,
        title: "Nouvelle inscription", body: "b", href,
        links: [{ label: "Voir l'inscription", href }, { label: "Voir l'évènement", href: `/event/${event.id}` }],
      },
    });

    const { POST } = await loadRoute();
    const res = await POST(post(reg.id, JSON.stringify({ categoryId: exposant.id })), {
      params: Promise.resolve({ id: reg.id }),
    });
    expect(res.status).toBe(200);
    const { id: newId } = await res.json();
    expect(newId).not.toBe(reg.id);

    const rewritten = await prisma.notification.findUniqueOrThrow({ where: { id: old.id } });
    expect(rewritten.href).toBe(`/event/${event.id}/registrations/${newId}`);
    expect((rewritten.links as { href: string }[])[0].href).toBe(`/event/${event.id}/registrations/${newId}`);
  });

  it("la notification de resoumission mentionne le changement de catégorie et pointe vers le nouvel ID", async () => {
    const { reg, exposant, event } = await seedRejected("catchg-notif-body");
    const admin = await seedTeamAdmin(event.id);

    const { POST } = await loadRoute();
    const res = await POST(post(reg.id, JSON.stringify({ categoryId: exposant.id })), {
      params: Promise.resolve({ id: reg.id }),
    });
    const { id: newId } = await res.json();

    const row = await prisma.notification.findFirstOrThrow({
      where: { userId: admin.id, type: "REGISTRATION_RESUBMITTED" },
    });
    expect(row.body).toContain("Presse");
    expect(row.body).toContain("Exposant");
    expect(row.href).toBe(`/event/${event.id}/registrations/${newId}`);
  });

  it("sans changement de catégorie, la notification de resoumission ne mentionne pas de catégorie", async () => {
    const { reg, event } = await seedRejected("catchg-notif-same");
    const admin = await seedTeamAdmin(event.id);

    const { POST } = await loadRoute();
    const res = await POST(post(reg.id), { params: Promise.resolve({ id: reg.id }) });
    expect(res.status).toBe(200);

    const row = await prisma.notification.findFirstOrThrow({
      where: { userId: admin.id, type: "REGISTRATION_RESUBMITTED" },
    });
    expect(row.body).not.toContain("catégorie");
    expect(row.href).toBe(`/event/${event.id}/registrations/${reg.id}`);
  });
});
