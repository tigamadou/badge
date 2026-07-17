import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";

describe("withOrgAuth", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.orgMembership.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 when no session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const handler = withOrgAuth("OWNER", async () => new Response("ok"));
    const req = new NextRequest("http://localhost/api/org/org-1");
    const res = await handler(req, { params: Promise.resolve({ orgId: "org-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not OWNER and not staff", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o1" } });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name, isStaff: false },
    } as never);

    const handler = withOrgAuth("OWNER", async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/org/${org.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(403);
  });

  it("passes for OWNER and exposes ctx", async () => {
    const u = await prisma.user.create({ data: { email: "o@x", password: "x", name: "O" } });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o2" } });
    await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role: "OWNER" } });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name, isStaff: false },
    } as never);

    let received: { orgId: string; userId: string; isStaff: boolean } | null = null;
    const handler = withOrgAuth("OWNER", async (_req, ctx) => {
      received = { orgId: ctx.orgId, userId: ctx.session.user.id, isStaff: ctx.session.user.isStaff };
      return new Response("ok");
    });
    const req = new NextRequest(`http://localhost/api/org/${org.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id }) });

    expect(res.status).toBe(200);
    expect(received).toEqual({ orgId: org.id, userId: u.id, isStaff: false });
  });

  it("passes for staff without OrgMembership", async () => {
    const s = await prisma.user.create({
      data: { email: "s@x", password: "x", name: "S", isStaff: true, staffRole: "STAFF_SUPPORT" },
    });
    const org = await prisma.organization.create({ data: { name: "O", slug: "o3" } });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: s.id, email: s.email, name: s.name, isStaff: true },
    } as never);

    const handler = withOrgAuth("OWNER", async () => new Response("ok"));
    const req = new NextRequest(`http://localhost/api/org/${org.id}`);
    const res = await handler(req, { params: Promise.resolve({ orgId: org.id }) });
    expect(res.status).toBe(200);
  });
});
