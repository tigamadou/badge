import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resetRateLimitForTests } from "@/lib/rate-limit";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

vi.mock("@/lib/mail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail")>();
  return {
    ...actual,
    sendAccountVerifyEmail: vi.fn().mockResolvedValue(undefined),
    sendAccountPasswordReset: vi.fn().mockResolvedValue(undefined),
    sendRegistrationConfirmation: vi.fn().mockResolvedValue(undefined),
    sendRegistrationResubmitted: vi.fn().mockResolvedValue(undefined),
    sendStatusNotification: vi.fn().mockResolvedValue(undefined),
    sendBadgePrintedNotification: vi.fn().mockResolvedValue(undefined),
  };
});

import { sendRegistrationConfirmation } from "@/lib/mail";

// Mocks partiels (fallback sur l'implementation reelle) pour exercer les branches
// de rethrow / retry qui ne sont pas atteignables avec des donnees reelles seules.
vi.mock("@/lib/subscription", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/subscription")>();
  return { ...actual, assertCanRegister: vi.fn(actual.assertCanRegister) };
});
import { assertCanRegister } from "@/lib/subscription";

vi.mock("@/lib/public-event", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/public-event")>();
  return { ...actual, loadPublicEventBySlug: vi.fn(actual.loadPublicEventBySlug) };
});
import { loadPublicEventBySlug } from "@/lib/public-event";

vi.mock("@/lib/generate-id", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/generate-id")>();
  return { ...actual, generateId: vi.fn(actual.generateId) };
});
import { generateId } from "@/lib/generate-id";

async function withSession(user: {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
}) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
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
      // v4 (plan 08) : l'inscription exige un profil valide par la plateforme.
      profileStatus: "APPROVED",
    },
  });
}

async function seedEvent(slug: string) {
  const org = await prisma.organization.create({
    data: { name: "Org", slug: `org-${slug}` },
  });
  const plan = await prisma.plan.create({
    data: { name: `plan-${slug}`, maxEvents: null, maxParticipantsPerEvent: null },
  });
  await prisma.subscription.create({
    data: { orgId: org.id, planId: plan.id, status: "ACTIVE" },
  });
  const event = await prisma.event.create({
    data: {
      orgId: org.id,
      title: "Event",
      slug,
      location: "Paris",
      date: new Date("2026-12-15"),
      registrationOpen: true,
    },
  });
  const category = await prisma.category.create({
    data: { eventId: event.id, name: "Cat", color: "#000000", number: 1 },
  });
  return { org, event, category };
}

function makeReq(slug: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/events/${slug}/register`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/events/[slug]/register", () => {
  beforeEach(() => {
    resetRateLimitForTests();
    vi.mocked(getServerSession).mockReset();
    vi.mocked(sendRegistrationConfirmation).mockClear();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const { POST } = await import("@/app/api/events/[slug]/register/route");
    // Need a real event so the route doesn't short-circuit on slug, but auth check is first.
    const { event, category } = await seedEvent("re-401");
    const res = await POST(makeReq(event.slug, { categoryId: category.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 PROFILE_INCOMPLETE when user profile is incomplete", async () => {
    const u = await prisma.user.create({
      data: {
        email: "incomplete@v2-11-evtreg.test",
        password: "x",
        name: "Incomplete",
        emailVerifiedAt: new Date(),
        firstName: "A", // only one field
      },
    });
    const { event, category } = await seedEvent("re-incomplete");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const res = await POST(makeReq(event.slug, { categoryId: category.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("PROFILE_INCOMPLETE");
  });

  it("refuse l'inscription si le profil n'est pas approuve (403 PROFILE_NOT_APPROVED)", async () => {
    const u = await createCompleteUser("gate-pending@v2-11-evtreg.test");
    await prisma.user.update({ where: { id: u.id }, data: { profileStatus: "PENDING" } });
    const { event, category } = await seedEvent("re-gate");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const res = await POST(makeReq(event.slug, { categoryId: category.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PROFILE_NOT_APPROVED");
    expect(await prisma.registration.count({ where: { userId: u.id } })).toBe(0);
  });

  it("creates a registration with snapshot reflecting the user profile at time t (201)", async () => {
    const u = await createCompleteUser("ok@v2-11-evtreg.test");
    const { event, category } = await seedEvent("re-ok");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const res = await POST(makeReq(event.slug, { categoryId: category.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(typeof json.id).toBe("string");

    const reg = await prisma.registration.findUnique({ where: { id: json.id } });
    expect(reg?.userId).toBe(u.id);
    expect(reg?.status).toBe("PENDING");
    expect(reg?.snapshotFirstName).toBe("Alice");
    expect(reg?.snapshotLastName).toBe("Doe");
    expect(reg?.snapshotEmail).toBe(u.email);
    expect(reg?.snapshotStructure).toBe("ACME");
    expect(reg?.snapshotPhoto).toBe("/uploads/photo.png");
    expect(reg?.snapshotIdDocumentType).toBe("CNI");
    expect(reg?.snapshotIdDocumentNumber).toBe("AB1234");
    expect(reg?.snapshotIdDocument).toBe("/uploads/doc.pdf");

    expect(vi.mocked(sendRegistrationConfirmation)).toHaveBeenCalledWith(json.id);

    const log = await prisma.activityLog.findFirst({
      where: { type: "REGISTRATION_CREATED", targetId: json.id },
    });
    expect(log).not.toBeNull();
    expect(log?.userId).toBe(u.id);
    expect(log?.eventId).toBe(event.id);

    // Mutate user profile after registration: snapshot must stay frozen at time t
    await prisma.user.update({
      where: { id: u.id },
      data: { firstName: "Renamed", lastName: "Later" },
    });
    const refetched = await prisma.registration.findUnique({ where: { id: json.id } });
    expect(refetched?.snapshotFirstName).toBe("Alice");
    expect(refetched?.snapshotLastName).toBe("Doe");
  });

  it("returns 409 ALREADY_REGISTERED when user already registered for the event", async () => {
    const u = await createCompleteUser("dup@v2-11-evtreg.test");
    const { event, category } = await seedEvent("re-dup");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const first = await POST(makeReq(event.slug, { categoryId: category.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(first.status).toBe(201);

    const second = await POST(makeReq(event.slug, { categoryId: category.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(second.status).toBe(409);
    const json = await second.json();
    expect(json.code).toBe("ALREADY_REGISTERED");
  });

  it("returns 400 BAD_CATEGORY when categoryId does not belong to the event", async () => {
    const u = await createCompleteUser("badcat@v2-11-evtreg.test");
    const { event } = await seedEvent("re-badcat");
    // Another event's category
    const { category: otherCategory } = await seedEvent("re-badcat-other");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const res = await POST(makeReq(event.slug, { categoryId: otherCategory.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("BAD_CATEGORY");
  });

  it("returns 429 RATE_LIMITED after 10 requests within the window", async () => {
    const u = await createCompleteUser("ratelimit@v2-11-evtreg.test");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    // Le rate-limit est verifie avant meme la resolution du slug : peu importe
    // que l'event existe ou que le body soit valide.
    for (let i = 0; i < 10; i++) {
      await POST(makeReq("re-ratelimit", { categoryId: "whatever" }), {
        params: Promise.resolve({ slug: "re-ratelimit" }),
      });
    }
    const res = await POST(makeReq("re-ratelimit", { categoryId: "whatever" }), {
      params: Promise.resolve({ slug: "re-ratelimit" }),
    });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.code).toBe("RATE_LIMITED");
  });

  it("returns 404 for an unknown event slug", async () => {
    const u = await createCompleteUser("unknownslug@v2-11-evtreg.test");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const res = await POST(makeReq("does-not-exist", { categoryId: "cat" }), {
      params: Promise.resolve({ slug: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe("NOT_FOUND");
  });

  it("returns 403 CLOSED when the event has registrations closed", async () => {
    const u = await createCompleteUser("closedevt@v2-11-evtreg.test");
    const org = await prisma.organization.create({ data: { name: "Org", slug: "org-re-closed" } });
    await prisma.event.create({
      data: {
        orgId: org.id,
        title: "Closed event",
        slug: "re-closed",
        location: "Paris",
        date: new Date("2026-12-15"),
        registrationOpen: false,
      },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const res = await POST(makeReq("re-closed", { categoryId: "cat" }), {
      params: Promise.resolve({ slug: "re-closed" }),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("CLOSED");
  });

  it("rethrows an unexpected error raised while loading the public event bundle", async () => {
    const u = await createCompleteUser("bundleerror@v2-11-evtreg.test");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    vi.mocked(loadPublicEventBySlug).mockRejectedValueOnce(new Error("boom-bundle"));

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    await expect(
      POST(makeReq("re-bundleerror", { categoryId: "cat" }), {
        params: Promise.resolve({ slug: "re-bundleerror" }),
      }),
    ).rejects.toThrow("boom-bundle");
  });

  it("returns 400 INVALID_BODY when the request body is not valid JSON", async () => {
    const u = await createCompleteUser("badjson@v2-11-evtreg.test");
    const { event } = await seedEvent("re-badjson");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const req = new NextRequest(`http://localhost/api/events/${event.slug}/register`, {
      method: "POST",
      body: "{not-valid-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, { params: Promise.resolve({ slug: event.slug }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_BODY");
  });

  it("returns 404 when the session references a user missing from the database", async () => {
    const { event, category } = await seedEvent("re-ghostuser");
    await withSession({ id: "ghost-user-id", email: "ghost@x.test", name: "Ghost", isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const res = await POST(makeReq(event.slug, { categoryId: category.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe("NOT_FOUND");
  });

  it("returns 409 EMAIL_BLOCKED when the participant's email is blocked", async () => {
    const email = "blocked-email@v2-11-evtreg.test";
    const u = await createCompleteUser(email);
    const { event, category } = await seedEvent("re-emailblocked");
    await prisma.blockedEmail.create({ data: { email, eventId: null } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const res = await POST(makeReq(event.slug, { categoryId: category.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("EMAIL_BLOCKED");
  });

  it("returns 409 DOCUMENT_BLOCKED when the participant's document number is blocked", async () => {
    const u = await createCompleteUser("docblocked@v2-11-evtreg.test");
    const { event, category } = await seedEvent("re-docblocked");
    await prisma.blockedDocument.create({
      data: { documentNumber: COMPLETE_PROFILE.idDocumentNumber, eventId: event.id },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const res = await POST(makeReq(event.slug, { categoryId: category.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("DOCUMENT_BLOCKED");
  });

  it("returns 429 PARTICIPANT_LIMIT once the event's subscription quota is reached", async () => {
    const org = await prisma.organization.create({ data: { name: "Org", slug: "org-re-limit" } });
    const plan = await prisma.plan.create({
      data: { name: "plan-re-limit", maxEvents: null, maxParticipantsPerEvent: 1 },
    });
    await prisma.subscription.create({ data: { orgId: org.id, planId: plan.id, status: "ACTIVE" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Event", slug: "re-limit", location: "Paris", date: new Date("2026-12-15"), registrationOpen: true },
    });
    const category = await prisma.category.create({ data: { eventId: event.id, name: "Cat", color: "#000000", number: 1 } });

    // Occupe le seul slot disponible avec un autre participant.
    const filler = await createCompleteUser("filler@v2-11-evtreg.test");
    await prisma.registration.create({
      data: {
        id: "reg-re-limit-filler",
        userId: filler.id,
        eventId: event.id,
        categoryId: category.id,
        status: "PENDING",
        snapshotFirstName: "F", snapshotLastName: "L", snapshotEmail: filler.email,
        snapshotStructure: "S", snapshotPhoto: "p", snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "FILLER1", snapshotIdDocument: "d",
      },
    });

    const u = await createCompleteUser("overlimit@v2-11-evtreg.test");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const res = await POST(makeReq(event.slug, { categoryId: category.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.code).toBe("PARTICIPANT_LIMIT");
  });

  it("returns 403 (message generique) when the org subscription is inactive", async () => {
    const org = await prisma.organization.create({ data: { name: "Org", slug: "org-re-inactive" } });
    const plan = await prisma.plan.create({
      data: { name: "plan-re-inactive", maxEvents: null, maxParticipantsPerEvent: null },
    });
    await prisma.subscription.create({ data: { orgId: org.id, planId: plan.id, status: "CANCELLED" } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "Event", slug: "re-inactive", location: "Paris", date: new Date("2026-12-15"), registrationOpen: true },
    });
    const category = await prisma.category.create({ data: { eventId: event.id, name: "Cat", color: "#000000", number: 1 } });

    const u = await createCompleteUser("inactivesub@v2-11-evtreg.test");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const res = await POST(makeReq(event.slug, { categoryId: category.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("SUBSCRIPTION_INACTIVE");
    expect(json.error).toBe("Inscriptions fermées.");
  });

  it("rethrows an unexpected error raised while checking the subscription quota", async () => {
    const u = await createCompleteUser("subscriptionerror@v2-11-evtreg.test");
    const { event, category } = await seedEvent("re-suberror");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    vi.mocked(assertCanRegister).mockRejectedValueOnce(new Error("boom-subscription"));

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    await expect(
      POST(makeReq(event.slug, { categoryId: category.id }), {
        params: Promise.resolve({ slug: event.slug }),
      }),
    ).rejects.toThrow("boom-subscription");
  });

  it("retries id generation on collision until a free id is found (201)", async () => {
    const u = await createCompleteUser("collision@v2-11-evtreg.test");
    const { event, category } = await seedEvent("re-collision");

    // Une registration existante occupe deja l'id que le premier generateId() va produire.
    const otherUser = await createCompleteUser("collision-filler@v2-11-evtreg.test");
    await prisma.registration.create({
      data: {
        id: "collide-id-1",
        userId: otherUser.id,
        eventId: event.id,
        categoryId: category.id,
        status: "PENDING",
        snapshotFirstName: "F", snapshotLastName: "L", snapshotEmail: otherUser.email,
        snapshotStructure: "S", snapshotPhoto: "p", snapshotIdDocumentType: "CNI",
        snapshotIdDocumentNumber: "COLLIDE1", snapshotIdDocument: "d",
      },
    });

    vi.mocked(generateId)
      .mockReturnValueOnce("collide-id-1")
      .mockReturnValueOnce("fresh-id-2");

    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const res = await POST(makeReq(event.slug, { categoryId: category.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("fresh-id-2");
  });

  it("still returns 201 (fire-and-forget) and logs an error when the confirmation email fails to send", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(sendRegistrationConfirmation).mockRejectedValueOnce(new Error("smtp down"));

    const u = await createCompleteUser("mailfail@v2-11-evtreg.test");
    const { event, category } = await seedEvent("re-mailfail");
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/events/[slug]/register/route");
    const res = await POST(makeReq(event.slug, { categoryId: category.id }), {
      params: Promise.resolve({ slug: event.slug }),
    });
    expect(res.status).toBe(201);

    // Laisse la microtask du .catch() fire-and-forget s'executer avant d'asserter.
    await new Promise((r) => setTimeout(r, 0));
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[mail] sendRegistrationConfirmation failed",
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });
});
