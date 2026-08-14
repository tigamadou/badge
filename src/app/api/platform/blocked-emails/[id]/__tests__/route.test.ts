import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

function noSession() {
  vi.mocked(getServerSession).mockResolvedValue(null as never);
}

async function asStaff(role: "STAFF_OBSERVER" | "STAFF_SUPPORT") {
  const u = await prisma.user.create({
    data: {
      email: `staff-${role}-${stamp()}@x.test`,
      password: "x",
      name: "S",
      isStaff: true,
      staffRole: role,
    },
  });
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: u.id, email: u.email, name: u.name, isStaff: true },
  } as never);
  return u;
}

function req(url: string, method: string) {
  return new NextRequest(`http://localhost${url}`, { method });
}

describe("DELETE /api/platform/blocked-emails/[id]", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("401 when not authenticated", async () => {
    noSession();
    const { DELETE } = await import("@/app/api/platform/blocked-emails/[id]/route");
    const res = await DELETE(req("/api/platform/blocked-emails/does-not-exist", "DELETE"), {
      params: Promise.resolve({ id: "does-not-exist" }),
    });
    expect(res.status).toBe(401);
  });

  it("403 for a staff role below STAFF_SUPPORT", async () => {
    await asStaff("STAFF_OBSERVER");
    const { DELETE } = await import("@/app/api/platform/blocked-emails/[id]/route");
    const res = await DELETE(req("/api/platform/blocked-emails/does-not-exist", "DELETE"), {
      params: Promise.resolve({ id: "does-not-exist" }),
    });
    expect(res.status).toBe(403);
  });

  it("404 when the id does not exist", async () => {
    await asStaff("STAFF_SUPPORT");
    const { DELETE } = await import("@/app/api/platform/blocked-emails/[id]/route");
    const res = await DELETE(req("/api/platform/blocked-emails/does-not-exist", "DELETE"), {
      params: Promise.resolve({ id: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
  });

  it("404 when the entry exists but is scoped to an event (eventId != null)", async () => {
    await asStaff("STAFF_SUPPORT");
    const org = await prisma.organization.create({ data: { name: "O", slug: `o-${stamp()}` } });
    const event = await prisma.event.create({
      data: { orgId: org.id, title: "E", slug: `e-${stamp()}`, location: "L", date: new Date() },
    });
    const eventScoped = await prisma.blockedEmail.create({
      data: { eventId: event.id, email: `evt-${stamp()}@x.test`, reason: null },
    });
    const { DELETE } = await import("@/app/api/platform/blocked-emails/[id]/route");
    const res = await DELETE(req(`/api/platform/blocked-emails/${eventScoped.id}`, "DELETE"), {
      params: Promise.resolve({ id: eventScoped.id }),
    });
    expect(res.status).toBe(404);
  });

  it("204 on success and logs PLATFORM_BLOCKED_EMAIL_REMOVED", async () => {
    const staff = await asStaff("STAFF_SUPPORT");
    const created = await prisma.blockedEmail.create({
      data: { eventId: null, email: `del-${stamp()}@x.test`, reason: null },
    });
    const { DELETE } = await import("@/app/api/platform/blocked-emails/[id]/route");
    const res = await DELETE(req(`/api/platform/blocked-emails/${created.id}`, "DELETE"), {
      params: Promise.resolve({ id: created.id }),
    });
    expect(res.status).toBe(204);
    expect(await prisma.blockedEmail.findUnique({ where: { id: created.id } })).toBeNull();

    const log = await prisma.activityLog.findFirst({
      where: { type: "PLATFORM_BLOCKED_EMAIL_REMOVED", targetId: created.id },
    });
    expect(log).not.toBeNull();
    expect(log?.userId).toBe(staff.id);
  });
});
