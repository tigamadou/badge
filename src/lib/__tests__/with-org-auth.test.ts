import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeOrgMember } from "@/test/factories";
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
    await prisma.role.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 when no session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const handler = withOrgAuth("OWNER", async () => new Response("ok"));
    const req = new NextRequest("http://localhost/api/org/org-1");
    const res = await handler(req, { params: Promise.resolve({ orgId: "org-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 when orgId is missing from params", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", email: "u@x", name: "U", isStaff: false },
    } as never);

    const handler = withOrgAuth("OWNER", async () => new Response("ok"));
    const req = new NextRequest("http://localhost/api/org/");
    const res = await handler(req, { params: Promise.resolve({ orgId: "" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Missing orgId");
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

  describe("garde par permission", () => {
    async function call(guard: Parameters<typeof withOrgAuth>[0], user: { id: string; email: string; name: string }, orgId: string, isStaff = false) {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, isStaff },
      } as never);
      const handler = withOrgAuth(guard, async () => new Response("ok"));
      return handler(new NextRequest(`http://localhost/api/org/${orgId}`), { params: Promise.resolve({ orgId }) });
    }

    async function member(slug: string, role: "OWNER" | "AUDITOR") {
      const u = await prisma.user.create({ data: { email: `${slug}@x`, password: "x", name: slug } });
      const org = await prisma.organization.create({ data: { name: "O", slug } });
      await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, role } });
      return { u, org };
    }

    it("OWNER : 200 sur org.members.read", async () => {
      const { u, org } = await member("pm1", "OWNER");
      expect((await call("org.members.read", u, org.id)).status).toBe(200);
    });

    it("AGENT : 403 PERMISSION_DENIED", async () => {
      const org = await prisma.organization.create({ data: { name: "O", slug: "pm2" } });
      const u = await makeOrgMember(org.id, "AGENT");
      const res = await call("org.members.read", u, org.id);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "PERMISSION_DENIED" });
    });

    it("staff SUPER_ADMIN sans appartenance : 200", async () => {
      const s = await prisma.user.create({
        data: { email: "sa@x", password: "x", name: "S", isStaff: true, staffRole: "SUPER_ADMIN" },
      });
      const org = await prisma.organization.create({ data: { name: "O", slug: "pm3" } });
      expect((await call("org.members.read", s, org.id, true)).status).toBe(200);
    });

    it("liste : satisfaite par la seconde clé seulement", async () => {
      const { u, org } = await member("pm4", "AUDITOR");
      expect((await call(["org.members.manage", "org.members.read"], u, org.id)).status).toBe(200);
      expect((await call(["org.members.manage", "org.update"], u, org.id)).status).toBe(403);
    });

    it("le rôle hérité AUDITOR reste accepté", async () => {
      const { u, org } = await member("pm5", "AUDITOR");
      expect((await call("AUDITOR", u, org.id)).status).toBe(200);
      expect((await call("OWNER", u, org.id)).status).toBe(403);
    });

    it("permission d'un autre niveau : erreur de configuration", () => {
      expect(() => withOrgAuth("print.sheets.read", async () => new Response("ok"))).toThrow("ORG");
    });
  });
});
