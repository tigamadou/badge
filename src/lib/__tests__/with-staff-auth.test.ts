import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";

describe("withStaffAuth", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 when no session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const handler = withStaffAuth(async () => new Response("ok"));
    const req = new NextRequest("http://localhost/api/platform/organizations");
    const res = await handler(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not staff", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    vi.mocked(getServerSession).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user: { id: u.id, email: u.email, name: u.name, isStaff: false },
    } as never);

    const handler = withStaffAuth(async () => new Response("ok"));
    const req = new NextRequest("http://localhost/api/platform/organizations");
    const res = await handler(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when staff role is below minRole", async () => {
    const u = await prisma.user.create({
      data: { email: "o@x", password: "x", name: "O", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name, isStaff: true },
    } as never);

    const handler = withStaffAuth(async () => new Response("ok"), { minRole: "STAFF_ADMIN" });
    const req = new NextRequest("http://localhost/api/platform/organizations");
    const res = await handler(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("passes for STAFF_OBSERVER on read-only handler (default minRole)", async () => {
    const u = await prisma.user.create({
      data: { email: "o@x", password: "x", name: "O", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name, isStaff: true },
    } as never);

    let received: { userId: string; isStaff: boolean } | null = null;
    const handler = withStaffAuth(async (_req, ctx) => {
      received = { userId: ctx.session.user.id, isStaff: ctx.session.user.isStaff };
      return new Response("ok");
    });
    const req = new NextRequest("http://localhost/api/platform/organizations");
    const res = await handler(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(received).toEqual({ userId: u.id, isStaff: true });
  });

  it("passes for STAFF_ADMIN when minRole=STAFF_ADMIN", async () => {
    const u = await prisma.user.create({
      data: { email: "a@x", password: "x", name: "A", isStaff: true, staffRole: "STAFF_ADMIN" },
    });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name, isStaff: true },
    } as never);

    const handler = withStaffAuth(async () => new Response("ok"), { minRole: "STAFF_ADMIN" });
    const req = new NextRequest("http://localhost/api/platform/organizations");
    const res = await handler(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
  });
});
