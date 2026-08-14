import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

type StaffRoleStr = "SUPER_ADMIN" | "STAFF_ADMIN" | "STAFF_SUPPORT" | "STAFF_OBSERVER";

function withSession(user: { id: string; email: string; name: string; isStaff: boolean }) {
  vi.mocked(getServerSession).mockResolvedValue({ user } as never);
}

function noSession() {
  vi.mocked(getServerSession).mockResolvedValue(null as never);
}

async function makeStaff(staffRole: StaffRoleStr) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return prisma.user.create({
    data: {
      email: `staff-${suffix}@bta.test`,
      password: "x",
      name: "Staff BTA",
      isStaff: true,
      staffRole,
    },
  });
}

const LAYOUT = {
  formatVersion: 1,
  family: "salon",
  label: "Salon",
  description: "",
  page: { widthPx: 1011, heightPx: 638, count: 1 },
  blocks: [{ type: "qr", page: 1, x: 0, y: 0, w: 10, h: 10 }],
};

async function install(installedById: string) {
  return prisma.installedBadgeTemplate.create({
    data: {
      family: `salon-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      version: 1,
      label: "Salon",
      description: "",
      pages: 1,
      pageWidthPx: 1011,
      pageHeightPx: 638,
      layout: LAYOUT,
      assetPrefix: "badge-templates/x/",
      formatVersion: 1,
      installedById,
    },
  });
}

async function patch(id: string, body: unknown) {
  const { PATCH } = await import("../route");
  return PATCH(
    new NextRequest(`http://localhost/api/platform/badge-templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("PATCH /api/platform/badge-templates/[id]", () => {
  beforeEach(async () => {
    await prisma.activityLog.deleteMany({ where: { type: "BADGE_TEMPLATE_ARCHIVED" } });
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("archive un template (200) et journalise", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const row = await install(staff.id);

    const res = await patch(row.id, { archived: true });
    expect(res.status).toBe(200);

    const updated = await prisma.installedBadgeTemplate.findUnique({ where: { id: row.id } });
    expect(updated?.archived).toBe(true);
    expect(updated?.archivedAt).not.toBeNull();

    const log = await prisma.activityLog.findFirst({ where: { type: "BADGE_TEMPLATE_ARCHIVED" } });
    expect(log?.targetId).toBe(row.id);
  });

  it("desarchive un template (200)", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const row = await install(staff.id);
    await patch(row.id, { archived: true });

    const res = await patch(row.id, { archived: false });
    expect(res.status).toBe(200);

    const updated = await prisma.installedBadgeTemplate.findUnique({ where: { id: row.id } });
    expect(updated?.archived).toBe(false);
    expect(updated?.archivedAt).toBeNull();
  });

  it("conserve layout et ressources apres archivage", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const row = await install(staff.id);

    await patch(row.id, { archived: true });

    const updated = await prisma.installedBadgeTemplate.findUnique({ where: { id: row.id } });
    expect(updated?.layout).toEqual(LAYOUT);
    expect(updated?.assetPrefix).toBe("badge-templates/x/");
  });

  it("refuse toute tentative de modifier le layout (400)", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const row = await install(staff.id);

    const res = await patch(row.id, { archived: true, layout: { blocks: [] } });
    expect(res.status).toBe(400);

    const untouched = await prisma.installedBadgeTemplate.findUnique({ where: { id: row.id } });
    expect(untouched?.layout).toEqual(LAYOUT);
    expect(untouched?.archived).toBe(false);
  });

  it("refuse un corps qui n'est pas du JSON (400)", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const row = await install(staff.id);

    const { PATCH } = await import("../route");
    const res = await PATCH(
      new NextRequest(`http://localhost/api/platform/badge-templates/${row.id}`, {
        method: "PATCH",
        body: "pas du json",
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: row.id }) },
    );
    expect(res.status).toBe(400);
  });

  it("refuse un corps sans archived (400)", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const row = await install(staff.id);

    expect((await patch(row.id, {})).status).toBe(400);
  });

  it("refuse sans session (401)", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    const row = await install(staff.id);
    noSession();

    expect((await patch(row.id, { archived: true })).status).toBe(401);
  });

  it("refuse un STAFF_SUPPORT (403)", async () => {
    const admin = await makeStaff("STAFF_ADMIN");
    const row = await install(admin.id);
    const support = await makeStaff("STAFF_SUPPORT");
    withSession({ id: support.id, email: support.email, name: support.name, isStaff: true });

    expect((await patch(row.id, { archived: true })).status).toBe(403);
  });

  it("renvoie 404 sur un identifiant inconnu", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });

    expect((await patch("inconnu-xyz", { archived: true })).status).toBe(404);
  });

  it("propage une erreur non-AuthError levee pendant le controle de role", async () => {
    const staff = await makeStaff("STAFF_ADMIN");
    const row = await install(staff.id);
    withSession({ id: staff.id, email: staff.email, name: staff.name, isStaff: true });
    const spy = vi.spyOn(prisma.user, "findUnique").mockRejectedValueOnce(new Error("boom-arch"));

    await expect(patch(row.id, { archived: true })).rejects.toThrow("boom-arch");
    spy.mockRestore();
  });
});
