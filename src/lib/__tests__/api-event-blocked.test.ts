import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

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
    data: { orgId: org.id, title: "E", slug: `e-${stamp}`, location: "L", date: new Date() },
  });
  await prisma.eventMembership.create({
    data: { userId: u.id, eventId: event.id, role: "ADMIN" },
  });
  return { u, org, event };
}

async function cleanup() {
  await prisma.activityLog.deleteMany();
  await prisma.blockedEmail.deleteMany();
  await prisma.blockedDocument.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.eventMembership.deleteMany();
  await prisma.event.deleteMany();
  await prisma.orgMembership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
  vi.mocked(getServerSession).mockReset();
}

describe("/blocked-emails", () => {
  beforeEach(cleanup);

  it("POST adds an entry; DELETE removes it", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/blocked-emails/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/blocked-emails`, {
        method: "POST",
        body: JSON.stringify({ email: "spam@x.test", reason: "spam" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { blocked: { id: string; email: string } };
    expect(json.blocked.email).toBe("spam@x.test");

    const log = await prisma.activityLog.findFirst({
      where: { type: "REGISTRATION_UPDATED", eventId: event.id },
    });
    expect(log).not.toBeNull();
    expect((log?.details as { action?: string } | null)?.action).toBe("blocked-email-added");

    const { DELETE } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/blocked-emails/[id]/route"
    );
    const r2 = await DELETE(
      new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/blocked-emails/${json.blocked.id}`, {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({ orgId: org.id, eventId: event.id, id: json.blocked.id } as never),
      },
    );
    expect(r2.status).toBe(204);
    expect(await prisma.blockedEmail.count()).toBe(0);
  });

  it("POST returns 409 on duplicate email within event", async () => {
    const { u, org, event } = await seedAdmin();
    await prisma.blockedEmail.create({
      data: { eventId: event.id, email: "dup@x.test", reason: null },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/blocked-emails/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/blocked-emails`, {
        method: "POST",
        body: JSON.stringify({ email: "dup@x.test" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(409);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe("ALREADY_BLOCKED");
  });

  it("OPERATOR cannot add (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `op-${stamp}@x.test`, password: "x", name: "Op" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-op-${stamp}` } });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "E",
        slug: `e-op-${stamp}`,
        location: "L",
        date: new Date(),
      },
    });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "OPERATOR" },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import("@/app/api/admin/[orgId]/events/[eventId]/blocked-emails/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/blocked-emails`, {
        method: "POST",
        body: JSON.stringify({ email: "x@x.test" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(403);
  });
});

describe("/blocked-documents", () => {
  beforeEach(cleanup);

  it("POST adds and audit logged; DELETE removes", async () => {
    const { u, org, event } = await seedAdmin();
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/blocked-documents/route"
    );
    const res = await POST(
      new NextRequest(`http://localhost/api/admin/${org.id}/events/${event.id}/blocked-documents`, {
        method: "POST",
        body: JSON.stringify({ documentNumber: "DOC-XX", reason: "faux" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(201);
    expect(await prisma.blockedDocument.count()).toBe(1);

    const log = await prisma.activityLog.findFirst({
      where: { type: "REGISTRATION_UPDATED", eventId: event.id },
    });
    expect((log?.details as { action?: string } | null)?.action).toBe("blocked-document-added");

    const created = await prisma.blockedDocument.findFirst({ where: { eventId: event.id } });
    const { DELETE } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/blocked-documents/[id]/route"
    );
    const r2 = await DELETE(
      new NextRequest(
        `http://localhost/api/admin/${org.id}/events/${event.id}/blocked-documents/${created!.id}`,
        { method: "DELETE" },
      ),
      {
        params: Promise.resolve({
          orgId: org.id,
          eventId: event.id,
          id: created!.id,
        } as never),
      },
    );
    expect(r2.status).toBe(204);
    expect(await prisma.blockedDocument.count()).toBe(0);
  });

  it("OPERATOR cannot add document (403)", async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const u = await prisma.user.create({
      data: { email: `op-${stamp}@x.test`, password: "x", name: "Op" },
    });
    const org = await prisma.organization.create({
      data: { name: "O", slug: `od-op-${stamp}` },
    });
    const event = await prisma.event.create({
      data: {
        orgId: org.id,
        title: "E",
        slug: `ed-op-${stamp}`,
        location: "L",
        date: new Date(),
      },
    });
    await prisma.eventMembership.create({
      data: { userId: u.id, eventId: event.id, role: "OPERATOR" },
    });
    await withSession({ id: u.id, email: u.email, name: u.name, isStaff: false });

    const { POST } = await import(
      "@/app/api/admin/[orgId]/events/[eventId]/blocked-documents/route"
    );
    const res = await POST(
      new NextRequest(
        `http://localhost/api/admin/${org.id}/events/${event.id}/blocked-documents`,
        {
          method: "POST",
          body: JSON.stringify({ documentNumber: "D1" }),
          headers: { "content-type": "application/json" },
        },
      ),
      { params: Promise.resolve({ orgId: org.id, eventId: event.id }) },
    );
    expect(res.status).toBe(403);
  });
});
