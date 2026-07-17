import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

afterAll(async () => {
  await prisma.activityLog.deleteMany();
  await prisma.eventSettings.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

async function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function seedAdmin() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await prisma.user.create({
    data: { email: `a-${stamp}@x.test`, password: "x", name: "A" },
  });
  const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp}` } });
  const event = await prisma.event.create({
    data: { orgId: org.id, title: "Old", slug: `evt-${stamp}`, location: "L", date: new Date("2026-12-01") },
  });
  await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "ADMIN" } });
  return { u, org, event };
}

describe("PATCH /api/org/[orgId]/events/[eventId]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.registration.deleteMany();
    await prisma.category.deleteMany();
    await prisma.eventMembership.deleteMany();
    await prisma.event.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("ADMIN updates title, location, date, registrationOpen", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: "New",
        location: "Paris",
        date: "2026-12-15",
        registrationOpen: true,
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);

    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.title).toBe("New");
    expect(updated?.location).toBe("Paris");
    expect(updated?.registrationOpen).toBe(true);
    expect(updated?.date.toISOString().slice(0, 10)).toBe("2026-12-15");
  });

  it("slug is immutable for non-staff (ignored silently)", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: "new-slug" }),
      headers: { "content-type": "application/json" },
    });
    await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.slug).not.toBe("new-slug");
  });

  it("staff can update slug", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const s = await prisma.user.create({
      data: { email: `s-${stamp}@x.test`, password: "x", name: "S", isStaff: true, staffRole: "STAFF_SUPPORT" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-staff-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: `old-slug-${stamp}`, location: "L", date: new Date() },
    });
    await withSession({ id: s.id, email: s.email, name: s.name, isStaff: true });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ slug: `new-slug-${stamp}` }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);
    const updated = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updated?.slug).toBe(`new-slug-${stamp}`);
  });

  it("toggle registrationOpen=true emits EVENT_REGISTRATION_OPENED log", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });
    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ registrationOpen: true }),
      headers: { "content-type": "application/json" },
    });
    await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const log = await prisma.activityLog.findFirst({ where: { type: "EVENT_REGISTRATION_OPENED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("OPERATOR cannot PATCH event (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({ data: { email: `op-${stamp}@x.test`, password: "x", name: "Op" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-op-${stamp}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "T", slug: `evt-op-${stamp}`, location: "L", date: new Date() },
    });
    await prisma.eventMembership.create({ data: { userId: u.id, eventId: event.id, role: "OPERATOR" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "x" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(403);
  });
});

async function cleanupSettings() {
  await prisma.activityLog.deleteMany();
  await prisma.eventSettings.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  vi.mocked(getServerSession).mockReset();
}

describe("GET /api/org/[orgId]/events/[eventId]/settings", () => {
  beforeEach(cleanupSettings);

  it("returns event settings + resolved cascade preview", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.eventSettings.create({
      data: { eventId: event.id, contactEmail: "c@evt.test", contactPhone: "+225 0101" },
    });
    await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        smtpHost: "p",
        smtpPort: 587,
        smtpFrom: "p@x.test",
        smtpUser: "",
        smtpPassword: "",
        smtpSecure: false,
        recaptchaEnabled: false,
        recaptchaSiteKey: "",
        recaptchaSecretKey: "",
      },
      update: {},
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { GET } = await import("@/app/api/org/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/settings`);
    const res = await GET(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.settings.contactEmail).toBe("c@evt.test");
    expect(json.settings.contactPhone).toBe("+225 0101");
    expect("smtpFrom" in json.settings).toBe(false);
    expect("smtpPassword" in json.resolved).toBe(false);
    expect("recaptchaSecretKey" in json.resolved).toBe(false);
  });
});

describe("PATCH /api/org/[orgId]/events/[eventId]/settings", () => {
  beforeEach(cleanupSettings);

  it("upserts EventSettings and audits EVENT_SETTINGS_UPDATED", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ contactEmail: "ce@x.test", contactPhone: "+225 0101" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(200);

    const s = await prisma.eventSettings.findUnique({ where: { eventId: event.id } });
    expect(s?.contactEmail).toBe("ce@x.test");
    expect(s?.contactPhone).toBe("+225 0101");
    const log = await prisma.activityLog.findFirst({ where: { type: "EVENT_SETTINGS_UPDATED" } });
    expect(log?.eventId).toBe(event.id);
  });

  it("null resets the override (cascade fallback)", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.eventSettings.create({ data: { eventId: event.id, contactEmail: "old@x.test" } });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ contactEmail: null }),
      headers: { "content-type": "application/json" },
    });
    await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    const s = await prisma.eventSettings.findUnique({ where: { eventId: event.id } });
    expect(s?.contactEmail).toBeNull();
  });

  it("refuses fields not allowed at event level (smtpFrom, smtpHost, smtpPassword)", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { PATCH } = await import("@/app/api/org/[orgId]/events/[eventId]/settings/route");
    const req = new NextRequest(`http://localhost/api/org/${org.id}/events/${event.id}/settings`, {
      method: "PATCH",
      body: JSON.stringify({ smtpFrom: "leak@x.test", smtpHost: "evil.smtp", smtpPassword: "leak" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ orgId: org.id, eventId: event.id }) });
    expect(res.status).toBe(400);
  });
});
