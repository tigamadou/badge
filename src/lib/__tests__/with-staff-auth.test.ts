import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import type { Permission } from "@/lib/permissions";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth";

describe("withStaffAuth", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 when no session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const handler = withStaffAuth(async () => new Response("ok"), { permission: "platform.access" });
    const req = new NextRequest("http://localhost/api/platform/organizations");
    const res = await handler(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not staff", async () => {
    const u = await prisma.user.create({ data: { email: "u@x", password: "x", name: "U" } });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name, isStaff: false },
    } as never);

    const handler = withStaffAuth(async () => new Response("ok"), { permission: "platform.access" });
    const req = new NextRequest("http://localhost/api/platform/organizations");
    const res = await handler(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("passes the session to the handler for a staff member holding the permission", async () => {
    const u = await prisma.user.create({
      data: { email: "o@x", password: "x", name: "O", isStaff: true, staffRole: "STAFF_OBSERVER" },
    });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: u.id, email: u.email, name: u.name, isStaff: true },
    } as never);

    let received: { userId: string; isStaff: boolean } | null = null;
    const handler = withStaffAuth(
      async (_req, ctx) => {
        received = { userId: ctx.session.user.id, isStaff: ctx.session.user.isStaff };
        return new Response("ok");
      },
      { permission: "platform.access" },
    );
    const req = new NextRequest("http://localhost/api/platform/organizations");
    const res = await handler(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(received).toEqual({ userId: u.id, isStaff: true });
  });

  describe("option permission", () => {
    async function platformRole(key: "STAFF_PRINTER") {
      return prisma.role.upsert({
        where: { systemKey: key },
        update: {},
        create: { scope: "PLATFORM", systemKey: key, name: key },
      });
    }

    async function call(opts: { permission: Permission | readonly Permission[] }, user: { id: string; email: string; name: string }, isStaff: boolean) {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: user.id, email: user.email, name: user.name, isStaff },
      } as never);
      const handler = withStaffAuth(async () => new Response("ok"), opts);
      return handler(new NextRequest("http://localhost/api/platform/x"), { params: Promise.resolve({}) });
    }

    it("STAFF_PRINTER passe sur print.sheets.read", async () => {
      const role = await platformRole("STAFF_PRINTER");
      const u = await prisma.user.create({
        data: { email: "p@x", password: "x", name: "P", isStaff: true, platformRoleId: role.id },
      });
      expect((await call({ permission: "print.sheets.read" }, u, true)).status).toBe(200);
    });

    it("charge le contexte utilisateur une seule fois", async () => {
      const u = await prisma.user.create({
        data: { email: "one@x", password: "x", name: "O", isStaff: true, staffRole: "STAFF_ADMIN" },
      });
      const spy = vi.spyOn(prisma.user, "findUnique");
      try {
        expect((await call({ permission: "print.sheets.read" }, u, true)).status).toBe(200);
        expect(spy).toHaveBeenCalledTimes(1);
      } finally {
        spy.mockRestore();
      }
    });

    it("STAFF_OBSERVER : 403 PERMISSION_DENIED", async () => {
      const u = await prisma.user.create({
        data: { email: "o2@x", password: "x", name: "O", isStaff: true, staffRole: "STAFF_OBSERVER" },
      });
      const res = await call({ permission: "print.sheets.read" }, u, true);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "PERMISSION_DENIED" });
    });

    it("non staff : 403 NOT_STAFF", async () => {
      const u = await prisma.user.create({ data: { email: "n@x", password: "x", name: "N" } });
      const res = await call({ permission: "print.sheets.read" }, u, false);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "NOT_STAFF" });
    });

    it("compte archivé : 401 NOT_AUTHENTICATED", async () => {
      const u = await prisma.user.create({
        data: { email: "arch@x", password: "x", name: "A", isStaff: true, staffRole: "SUPER_ADMIN", archived: true },
      });
      const res = await call({ permission: "print.sheets.read" }, u, true);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "NOT_AUTHENTICATED" });
    });

    it("liste : satisfaite par la seconde clé seulement", async () => {
      const role = await platformRole("STAFF_PRINTER");
      const u = await prisma.user.create({
        data: { email: "p3@x", password: "x", name: "P", isStaff: true, platformRoleId: role.id },
      });
      expect((await call({ permission: ["users.archive", "print.sheets.read"] }, u, true)).status).toBe(200);
      const res = await call({ permission: ["users.archive", "users.create"] }, u, true);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "PERMISSION_DENIED" });
    });

    it("permission d'un autre niveau : erreur de configuration", () => {
      expect(() => withStaffAuth(async () => new Response("ok"), { permission: "org.members.read" })).toThrow("PLATFORM");
    });
  });
});
