import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { makePng, putTestImage } from "@/test/factories-2a";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function withSession(user: {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
}) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

function makeReq(body?: unknown, method: "GET" | "PUT" = "GET"): NextRequest {
  return new NextRequest("http://localhost/api/account/profile", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "content-type": "application/json" },
  });
}

// Photos reelles dans le stockage de test : la route relit la photo qui change.
const PHOTO_KEY = "test-2a/profile-photo.png";
const NEW_PHOTO_KEY = "test-2a/profile-photo-new.png";
beforeAll(async () => {
  await putTestImage(PHOTO_KEY, makePng(420, 540), "image/png");
  await putTestImage(NEW_PHOTO_KEY, makePng(420, 540), "image/png");
});

const COMPLETE_PROFILE = {
  firstName: "Alice",
  lastName: "Doe",
  structure: "ACME",
  photo: PHOTO_KEY,
  idDocumentType: "CNI",
  idDocumentNumber: "AB1234",
  idDocument: "/uploads/doc.pdf",
};

describe("GET /api/account/profile", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { GET } = await import("@/app/api/account/profile/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns the user without password or token fields", async () => {
    const u = await prisma.user.create({
      data: {
        email: "user@v2-11-profile.test",
        password: "hashed-secret",
        name: "User",
        emailVerifyToken: "tokhash",
        emailVerifyTokenExpiry: new Date(),
        passwordResetToken: "rtokhash",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/account/profile/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user.id).toBe(u.id);
    expect(json.user.email).toBe(u.email);
    expect(json.user).not.toHaveProperty("password");
    expect(json.user).not.toHaveProperty("emailVerifyToken");
    expect(json.user).not.toHaveProperty("passwordResetToken");
    expect(json.user).not.toHaveProperty("passwordResetExpiry");
  });

  it("returns 404 when the session user no longer exists in DB", async () => {
    await withSession({
      id: "ghost-user-id",
      email: "ghost@v2-11-profile.test",
      name: "Ghost",
      isStaff: false,
    });

    const { GET } = await import("@/app/api/account/profile/route");
    const res = await GET(makeReq());
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe("NOT_FOUND");
  });

  describe("unexpected prisma failure", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("rethrows a non-AuthError raised while loading the user", async () => {
      const u = await prisma.user.create({
        data: { email: "rethrow-get@v2-11-profile.test", password: "x", name: "U" },
      });
      await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
      vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("boom-profile-get"));

      const { GET } = await import("@/app/api/account/profile/route");
      await expect(GET(makeReq())).rejects.toThrow("boom-profile-get");
    });
  });
});

describe("PUT /api/account/profile : photo d'identité", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  async function setup(photo: string | null = null) {
    const u = await prisma.user.create({
      data: { email: `ph-${Date.now()}@v2-11-profile.test`, password: "x", name: "Ph", photo },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { PUT } = await import("@/app/api/account/profile/route");
    return { u, put: (body: unknown) => PUT(makeReq(body, "PUT")) };
  }

  it("refuse une photo hors ratio et laisse la colonne inchangée", async () => {
    const { u, put } = await setup();
    const square = await putTestImage("test-2a/profile-square.png", makePng(540, 540), "image/png");
    const res = await put({ photo: square });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("IMAGE_RATIO");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).photo).toBeNull();
  });

  it("refuse une clé absente du stockage", async () => {
    const { put } = await setup();
    const res = await put({ photo: "test-2a/absente.png" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_IMAGE");
  });

  it("n'impose rien à la photo déjà enregistrée, même non conforme", async () => {
    const square = await putTestImage("test-2a/profile-square.png", makePng(540, 540), "image/png");
    const { put } = await setup(square);
    expect((await put({ photo: square, structure: "Autre" })).status).toBe(200);
  });
});

describe("PUT /api/account/profile", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq({ firstName: "X" }, "PUT"));
    expect(res.status).toBe(401);
  });

  it("updates all profile fields, recomputes participantProfileCompletedAt and logs USER_PROFILE_UPDATED", async () => {
    const u = await prisma.user.create({
      data: {
        email: "put@v2-11-profile.test",
        password: "x",
        name: "Put",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq(COMPLETE_PROFILE, "PUT"));
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.firstName).toBe("Alice");
    expect(updated?.lastName).toBe("Doe");
    expect(updated?.structure).toBe("ACME");
    expect(updated?.photo).toBe(PHOTO_KEY);
    expect(updated?.idDocumentType).toBe("CNI");
    expect(updated?.idDocumentNumber).toBe("AB1234");
    expect(updated?.idDocument).toBe("/uploads/doc.pdf");
    expect(updated?.participantProfileCompletedAt).not.toBeNull();

    const log = await prisma.activityLog.findFirst({
      where: { type: "USER_PROFILE_UPDATED", userId: u.id },
    });
    expect(log).not.toBeNull();
  });

  it("ignores unknown fields silently", async () => {
    const u = await prisma.user.create({
      data: {
        email: "ignore@v2-11-profile.test",
        password: "x",
        name: "Ignore",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(
      makeReq({ firstName: "Bob", isStaff: true, password: "newpw", foo: "bar" }, "PUT"),
    );
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.firstName).toBe("Bob");
    expect(updated?.isStaff).toBe(false);
    expect(updated?.password).toBe("x"); // unchanged
  });

  it("does not mark profile as complete when only partial fields are provided", async () => {
    const u = await prisma.user.create({
      data: {
        email: "partial@v2-11-profile.test",
        password: "x",
        name: "Partial",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq({ firstName: "A", lastName: "B" }, "PUT"));
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: u.id } });
    expect(updated?.participantProfileCompletedAt).toBeNull();
  });

  it("returns 400 when the request body is not valid JSON", async () => {
    const u = await prisma.user.create({
      data: { email: "badjson@v2-11-profile.test", password: "x", name: "U" },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const req = new NextRequest("http://localhost/api/account/profile", {
      method: "PUT",
      body: "{not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_BODY");
  });

  it("returns 400 when a field fails schema validation", async () => {
    const u = await prisma.user.create({
      data: { email: "invalidfield@v2-11-profile.test", password: "x", name: "U" },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq({ idDocumentType: "NOT_A_VALID_TYPE" }, "PUT"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_BODY");
  });

  it("returns 403 DOCUMENT_BLOCKED when idDocumentNumber matches a platform-wide block", async () => {
    const u = await prisma.user.create({
      data: { email: "blocked@v2-11-profile.test", password: "x", name: "U" },
    });
    await prisma.blockedDocument.create({
      data: { documentNumber: "BLOCKED-123", eventId: null },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq({ idDocumentNumber: "BLOCKED-123" }, "PUT"));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("DOCUMENT_BLOCKED");
  });

  it("returns 404 when the session user no longer exists in DB", async () => {
    await withSession({
      id: "ghost-user-id-put",
      email: "ghost-put@v2-11-profile.test",
      name: "Ghost",
      isStaff: false,
    });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq({ firstName: "X" }, "PUT"));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe("NOT_FOUND");
  });

  it("cree une soumission de profil quand les pieces deviennent completes", async () => {
    const u = await prisma.user.create({
      data: { email: "submit@profile08.test", password: "x", name: "U" },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq(COMPLETE_PROFILE, "PUT"));
    expect(res.status).toBe(200);

    const submissions = await prisma.profileSubmission.findMany({ where: { userId: u.id } });
    expect(submissions).toHaveLength(1);
    expect(submissions[0].status).toBe("PENDING");
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.profileStatus).toBe("PENDING");
  });

  it("ne cree pas de soumission quand seuls des champs non lies a l'identite changent", async () => {
    const u = await prisma.user.create({
      data: { email: "stable@profile08.test", password: "x", name: "U", ...COMPLETE_PROFILE, profileStatus: "APPROVED" },
    });
    await prisma.profileSubmission.create({
      data: {
        userId: u.id,
        photo: COMPLETE_PROFILE.photo,
        idDocumentType: COMPLETE_PROFILE.idDocumentType,
        idDocumentNumber: COMPLETE_PROFILE.idDocumentNumber,
        idDocument: COMPLETE_PROFILE.idDocument,
        status: "APPROVED",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq({ structure: "Nouvelle structure" }, "PUT"));
    expect(res.status).toBe(200);
    expect(await prisma.profileSubmission.count({ where: { userId: u.id } })).toBe(1);
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.profileStatus).toBe("APPROVED");
  });

  it("repasse en PENDING quand la piece d'identite est remplacee", async () => {
    const u = await prisma.user.create({
      data: { email: "newdoc@profile08.test", password: "x", name: "U", ...COMPLETE_PROFILE, profileStatus: "APPROVED" },
    });
    await prisma.profileSubmission.create({
      data: {
        userId: u.id,
        photo: COMPLETE_PROFILE.photo,
        idDocumentType: COMPLETE_PROFILE.idDocumentType,
        idDocumentNumber: COMPLETE_PROFILE.idDocumentNumber,
        idDocument: COMPLETE_PROFILE.idDocument,
        status: "APPROVED",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq({ idDocument: "/uploads/doc2.pdf" }, "PUT"));
    expect(res.status).toBe(200);
    expect(await prisma.profileSubmission.count({ where: { userId: u.id } })).toBe(2);
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.profileStatus).toBe("PENDING");
  });

  it("expose le statut du profil et la soumission courante en GET", async () => {
    const u = await prisma.user.create({
      data: { email: "status@profile08.test", password: "x", name: "U", ...COMPLETE_PROFILE, profileStatus: "APPROVED" },
    });
    await prisma.profileSubmission.create({
      data: {
        userId: u.id,
        photo: COMPLETE_PROFILE.photo,
        idDocumentType: COMPLETE_PROFILE.idDocumentType,
        idDocumentNumber: COMPLETE_PROFILE.idDocumentNumber,
        idDocument: COMPLETE_PROFILE.idDocument,
        status: "APPROVED",
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/account/profile/route");
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json.user.profileStatus).toBe("APPROVED");
    expect(json.currentSubmission.status).toBe("APPROVED");
    expect(json.currentSubmission).not.toHaveProperty("reviewedById");
  });

  describe("unexpected prisma failure", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("rethrows a non-AuthError raised while persisting the update", async () => {
      const u = await prisma.user.create({
        data: { email: "rethrow-put@v2-11-profile.test", password: "x", name: "U" },
      });
      await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
      vi.spyOn(prisma.user, "update").mockRejectedValueOnce(new Error("boom-profile-put"));

      const { PUT } = await import("@/app/api/account/profile/route");
      await expect(PUT(makeReq({ firstName: "X" }, "PUT"))).rejects.toThrow(
        "boom-profile-put",
      );
    });
  });
});

describe("PUT /api/account/profile — propagation aux inscriptions en attente", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  async function seedPendingRegistration(scope: string) {
    const user = await prisma.user.create({
      data: {
        email: `sync-${scope}@profile.test`,
        password: "x",
        name: "P",
        ...COMPLETE_PROFILE,
      },
    });
    const org = await prisma.organization.create({
      data: { name: `Org ${scope}`, slug: `org-sync-${scope}` },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Event",
        slug: `event-sync-${scope}`,
        location: "L",
        date: new Date("2026-12-15"),
      },
    });
    const category = await prisma.category.create({
      data: { eventId: event.id, name: "Cat", color: "#123456", number: 1 },
    });
    const registration = await prisma.registration.create({
      data: {
        id: `reg-profile-${scope}`,
        userId: user.id,
        eventId: event.id,
        categoryId: category.id,
        status: "PENDING",
        snapshotFirstName: COMPLETE_PROFILE.firstName,
        snapshotLastName: COMPLETE_PROFILE.lastName,
        snapshotEmail: user.email,
        snapshotStructure: COMPLETE_PROFILE.structure,
        snapshotPhoto: COMPLETE_PROFILE.photo,
        snapshotIdDocumentType: COMPLETE_PROFILE.idDocumentType,
        snapshotIdDocumentNumber: COMPLETE_PROFILE.idDocumentNumber,
        snapshotIdDocument: COMPLETE_PROFILE.idDocument,
      },
    });
    return { user, org, event, registration };
  }

  it("repercute la nouvelle photo jusqu'au snapshot et journalise", async () => {
    const { user, org, event, registration } = await seedPendingRegistration("a");
    await withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq({ photo: NEW_PHOTO_KEY }, "PUT"));

    expect(res.status).toBe(200);
    const after = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });
    expect(after.snapshotPhoto).toBe(NEW_PHOTO_KEY);

    const log = await prisma.activityLog.findFirst({
      where: { type: "REGISTRATION_SNAPSHOT_REFRESHED", targetId: registration.id },
    });
    expect(log).not.toBeNull();
    expect(log?.eventId).toBe(event.id);
    expect(log?.orgId).toBe(org.id);
    expect(log?.userId).toBe(user.id);
    expect(log?.details).toMatchObject({ outcome: "refreshed" });
  });

  it("ne journalise rien quand aucun champ de snapshot ne change", async () => {
    const { user } = await seedPendingRegistration("b");
    await withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq({ photo: COMPLETE_PROFILE.photo }, "PUT"));

    expect(res.status).toBe(200);
    const count = await prisma.activityLog.count({
      where: { type: "REGISTRATION_SNAPSHOT_REFRESHED" },
    });
    expect(count).toBe(0);
  });

  it("journalise le saut quand le nouveau numero de piece est bloque", async () => {
    const { user, event, registration } = await seedPendingRegistration("c");
    await prisma.blockedDocument.create({
      data: { eventId: event.id, documentNumber: "BLOQUE-9", reason: "Fraude" },
    });
    await withSession({ id: user.id, email: user.email, name: user.name, isStaff: false });

    const { PUT } = await import("@/app/api/account/profile/route");
    const res = await PUT(makeReq({ idDocumentNumber: "BLOQUE-9" }, "PUT"));

    expect(res.status).toBe(200);
    const after = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });
    expect(after.snapshotIdDocumentNumber).toBe(COMPLETE_PROFILE.idDocumentNumber);

    const log = await prisma.activityLog.findFirstOrThrow({
      where: { type: "REGISTRATION_SNAPSHOT_REFRESHED", targetId: registration.id },
    });
    expect(log.details).toMatchObject({ outcome: "skipped_document_blocked" });
  });
});
