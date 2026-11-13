import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

async function makeStaff(staffRole: StaffRoleStr = "STAFF_ADMIN") {
  const u = await prisma.user.create({
    data: {
      email: `s-${Date.now()}-${Math.random()}@x`,
      password: "x",
      name: "Staff",
      isStaff: true,
      staffRole,
    },
  });
  withSession({ id: u.id, email: u.email, name: u.name, isStaff: true });
  return u;
}

function uniqueSlug(prefix = "o") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

describe("DELETE /api/platform/organizations/[orgId]/owners/[userId]", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/[userId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners/some-user`,
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, userId: "some-user" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects STAFF_SUPPORT with 403 (below STAFF_ADMIN)", async () => {
    await makeStaff("STAFF_SUPPORT");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/[userId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners/some-user`,
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, userId: "some-user" }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects STAFF_OBSERVER with 403", async () => {
    await makeStaff("STAFF_OBSERVER");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/[userId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners/some-user`,
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, userId: "some-user" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the user is not a member of the org", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const stranger = await prisma.user.create({
      data: { email: "stranger@x.com", password: "x", name: "Stranger" },
    });

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/[userId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners/${stranger.id}`,
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, userId: stranger.id }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 NOT_OWNER when the target membership is not OWNER", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const manager = await prisma.user.create({
      data: { email: "mgr@x.com", password: "x", name: "Manager" },
    });
    await prisma.orgMembership.create({
      data: { userId: manager.id, orgId: org.id, role: "MANAGER" },
    });

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/[userId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners/${manager.id}`,
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, userId: manager.id }),
    });
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBe("NOT_OWNER");

    const stillThere = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: manager.id, orgId: org.id } },
    });
    expect(stillThere).not.toBeNull();
  });

  it("returns 409 LAST_OWNER when removing the sole remaining owner", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const soleOwner = await prisma.user.create({
      data: { email: "sole@x.com", password: "x", name: "Sole Owner" },
    });
    await prisma.orgMembership.create({
      data: { userId: soleOwner.id, orgId: org.id, role: "OWNER" },
    });

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/[userId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners/${soleOwner.id}`,
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, userId: soleOwner.id }),
    });
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBe("LAST_OWNER");

    const stillThere = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: soleOwner.id, orgId: org.id } },
    });
    expect(stillThere).not.toBeNull();
  });

  it("rethrows a non-AuthError raised while checking the last-owner guard", async () => {
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const owner = await prisma.user.create({
      data: { email: "boom@x.com", password: "x", name: "Boom Owner" },
    });
    await prisma.orgMembership.create({
      data: { userId: owner.id, orgId: org.id, role: "OWNER" },
    });

    // assertNotLastOwner commence par prisma.organization.findUnique : on force
    // un rejet ordinaire (non-AuthError) sur ce seul appel, cible via mockRejectedValueOnce.
    const spy = vi
      .spyOn(prisma.organization, "findUnique")
      .mockRejectedValueOnce(new Error("boom"));

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/[userId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners/${owner.id}`,
      { method: "DELETE" },
    );
    await expect(
      DELETE(req, { params: Promise.resolve({ orgId: org.id, userId: owner.id }) }),
    ).rejects.toThrow("boom");
    spy.mockRestore();
  });

  it("removes an OWNER when another OWNER remains, logs MEMBERSHIP_REMOVED, returns 204", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const owner1 = await prisma.user.create({
      data: { email: "owner1@x.com", password: "x", name: "Owner One" },
    });
    const owner2 = await prisma.user.create({
      data: { email: "owner2@x.com", password: "x", name: "Owner Two" },
    });
    await prisma.orgMembership.create({
      data: { userId: owner1.id, orgId: org.id, role: "OWNER" },
    });
    await prisma.orgMembership.create({
      data: { userId: owner2.id, orgId: org.id, role: "OWNER" },
    });

    const { DELETE } = await import(
      "@/app/api/platform/organizations/[orgId]/owners/[userId]/route"
    );
    const req = new NextRequest(
      `http://localhost/api/platform/organizations/${org.id}/owners/${owner1.id}`,
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ orgId: org.id, userId: owner1.id }),
    });
    expect(res.status).toBe(204);

    const removedMembership = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: owner1.id, orgId: org.id } },
    });
    expect(removedMembership).toBeNull();

    const remainingMembership = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: owner2.id, orgId: org.id } },
    });
    expect(remainingMembership).not.toBeNull();

    const log = await prisma.activityLog.findFirst({
      where: { type: "MEMBERSHIP_REMOVED", targetId: owner1.id, orgId: org.id },
    });
    expect(log).not.toBeNull();
    expect(log?.userId).toBe(staff.id);
    expect(log?.staffActor).toBe(true);
  });
});

describe("DELETE owners : lignes migrées (roleId)", () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("retire un propriétaire porteur du rôle OWNER par roleId, refuse un membre porteur d'un autre rôle", async () => {
    const { systemRoleId } = await import("@/lib/permissions/db");
    await makeStaff("STAFF_ADMIN");
    const org = await prisma.organization.create({ data: { name: "X", slug: uniqueSlug() } });
    const mk = async (email: string, key: "OWNER" | "MANAGER") => {
      const u = await prisma.user.create({ data: { email, password: "x", name: email } });
      await prisma.orgMembership.create({ data: { userId: u.id, orgId: org.id, roleId: await systemRoleId(prisma, key) } });
      return u;
    };
    const o1 = await mk("o1@x.com", "OWNER");
    await mk("o2@x.com", "OWNER");
    const mgr = await mk("m@x.com", "MANAGER");
    const { DELETE } = await import("@/app/api/platform/organizations/[orgId]/owners/[userId]/route");
    const call = (userId: string) =>
      DELETE(new NextRequest("http://localhost/x", { method: "DELETE" }), { params: Promise.resolve({ orgId: org.id, userId }) });
    expect((await call(mgr.id)).status).toBe(409);
    expect((await call(o1.id)).status).toBe(204);
  });
});
