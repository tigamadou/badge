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
    },
  });
}

async function seedEvent(slug: string) {
  const org = await prisma.organization.create({
    data: { name: "Org", slug: `org-${slug}` },
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
});
