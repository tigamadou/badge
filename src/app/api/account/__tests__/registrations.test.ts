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

async function withSession(user: {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
}) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function seedEventBundle(slug: string) {
  const org = await prisma.organization.create({
    data: { name: "Org", slug: `org-${slug}` },
  });
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
      vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce(null);

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
      vi.spyOn(prisma.registration, "update").mockRejectedValueOnce(
        new Error("boom-resubmit"),
      );

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
