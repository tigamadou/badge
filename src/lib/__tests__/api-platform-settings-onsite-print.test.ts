import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOnsitePrintSettings } from "@/lib/settings";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth";

async function asStaff(role: "STAFF_ADMIN" | "STAFF_SUPPORT") {
  const u = await prisma.user.create({
    data: {
      email: `staff-${role}-${Date.now()}-${Math.random()}@x`,
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

function req(body: unknown) {
  return new NextRequest("http://localhost/api/platform/settings/onsite-print", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

async function install(version: number) {
  return prisma.installedBadgeTemplate.create({
    data: {
      family: `onsite-${Date.now()}-${Math.random()}`,
      version,
      label: "Salon",
      description: "",
      pages: 1,
      pageWidthPx: 324,
      pageHeightPx: 204,
      layout: {},
      assetPrefix: "badge-templates/test/",
      formatVersion: 3,
      installedById: "u1",
    },
  });
}

async function call(body: unknown) {
  const { PATCH } = await import("@/app/api/platform/settings/onsite-print/route");
  return PATCH(req(body), { params: Promise.resolve({}) });
}

describe("PATCH /api/platform/settings/onsite-print", () => {
  beforeEach(async () => {
    vi.mocked(getServerSession).mockReset();
    await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      update: { onsitePrintTemplateIds: [], onsitePrinterNote: null, onsiteDefaultMarginPercent: 10 },
      create: { id: "singleton" },
    });
  });

  it("enregistre deux templates, la note et 15 %", async () => {
    await asStaff("STAFF_ADMIN");
    const t1 = await install(1);
    const t2 = await install(2);
    const res = await call({
      templateIds: [t1.id, t2.id],
      printerNote: "Zebra ZC300, CR80",
      defaultMarginPercent: 15,
    });
    expect(res.status).toBe(200);
    const expected = {
      templateIds: [t1.id, t2.id],
      printerNote: "Zebra ZC300, CR80",
      defaultMarginPercent: 15,
    };
    expect((await res.json()).settings).toEqual(expected);
    expect(await getOnsitePrintSettings()).toEqual(expected);
  });

  it("crée le singleton s'il est absent", async () => {
    await asStaff("STAFF_ADMIN");
    await prisma.platformSettings.deleteMany();
    const res = await call({ templateIds: [], printerNote: null, defaultMarginPercent: 0 });
    expect(res.status).toBe(200);
    expect(await getOnsitePrintSettings()).toEqual({
      templateIds: [],
      printerNote: null,
      defaultMarginPercent: 0,
    });
  });

  it("401 sans session, 403 STAFF_SUPPORT", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const body = { templateIds: [], printerNote: null, defaultMarginPercent: 10 };
    expect((await call(body)).status).toBe(401);
    await asStaff("STAFF_SUPPORT");
    expect((await call(body)).status).toBe(403);
  });

  it("400 INVALID_BODY pour une marge de 101, -1 ou non entière, ou une note trop longue", async () => {
    await asStaff("STAFF_ADMIN");
    for (const defaultMarginPercent of [101, -1, 2.5]) {
      const res = await call({ templateIds: [], printerNote: null, defaultMarginPercent });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("INVALID_BODY");
    }
    const long = await call({ templateIds: [], printerNote: "x".repeat(501), defaultMarginPercent: 10 });
    expect(long.status).toBe(400);
  });

  it("400 UNKNOWN_TEMPLATE pour un identifiant inconnu, rien n'est écrit", async () => {
    await asStaff("STAFF_ADMIN");
    const t1 = await install(1);
    const res = await call({
      templateIds: [t1.id, "inconnu"],
      printerNote: "note",
      defaultMarginPercent: 20,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("UNKNOWN_TEMPLATE");
    expect(await getOnsitePrintSettings()).toEqual({
      templateIds: [],
      printerNote: null,
      defaultMarginPercent: 10,
    });
  });

  it("dédoublonne les identifiants et journalise PLATFORM_SETTINGS_UPDATED", async () => {
    const admin = await asStaff("STAFF_ADMIN");
    const t1 = await install(1);
    const t2 = await install(2);
    const res = await call({
      templateIds: [t1.id, t2.id, t1.id],
      printerNote: null,
      defaultMarginPercent: 10,
    });
    expect(res.status).toBe(200);
    expect((await getOnsitePrintSettings()).templateIds).toEqual([t1.id, t2.id]);
    const log = await prisma.activityLog.findFirst({
      where: { type: "PLATFORM_SETTINGS_UPDATED", userId: admin.id },
    });
    expect(log?.details).toMatchObject({ section: "onsite-print", templateCount: 2 });
  });

  it("400 INVALID_BODY pour un corps non JSON", async () => {
    await asStaff("STAFF_ADMIN");
    const { PATCH } = await import("@/app/api/platform/settings/onsite-print/route");
    const bad = new NextRequest("http://localhost/api/platform/settings/onsite-print", {
      method: "PATCH",
      body: "{not json",
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(bad, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_BODY");
  });

  it("400 INVALID_BODY pour un identifiant de plus de 64 caractères", async () => {
    await asStaff("STAFF_ADMIN");
    const res = await call({ templateIds: ["x".repeat(65)], printerNote: null, defaultMarginPercent: 10 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("INVALID_BODY");
  });

  it("rogne la note ; une note blanche devient null", async () => {
    await asStaff("STAFF_ADMIN");
    await call({ templateIds: [], printerNote: "  Zebra  ", defaultMarginPercent: 10 });
    expect((await getOnsitePrintSettings()).printerNote).toBe("Zebra");
    await call({ templateIds: [], printerNote: "   ", defaultMarginPercent: 10 });
    expect((await getOnsitePrintSettings()).printerNote).toBeNull();
  });

  it("400 UNKNOWN_TEMPLATE pour un template archivé", async () => {
    await asStaff("STAFF_ADMIN");
    const t = await install(1);
    await prisma.installedBadgeTemplate.update({ where: { id: t.id }, data: { archived: true } });
    const res = await call({ templateIds: [t.id], printerNote: null, defaultMarginPercent: 10 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("UNKNOWN_TEMPLATE");
  });

  it("un template archivé déjà dans la liste enregistrée reste accepté ; un nouvel archivé est refusé", async () => {
    await asStaff("STAFF_ADMIN");
    const kept = await install(1);
    const added = await install(2);
    const fresh = await install(3);
    await prisma.platformSettings.update({ where: { id: "singleton" }, data: { onsitePrintTemplateIds: [kept.id] } });
    await prisma.installedBadgeTemplate.updateMany({ where: { id: { in: [kept.id, added.id] } }, data: { archived: true } });
    const refused = await call({ templateIds: [kept.id, added.id], printerNote: null, defaultMarginPercent: 20 });
    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toBe("UNKNOWN_TEMPLATE");
    const ok = await call({ templateIds: [kept.id, fresh.id], printerNote: "Zebra", defaultMarginPercent: 20 });
    expect(ok.status).toBe(200);
    expect(await getOnsitePrintSettings()).toMatchObject({
      templateIds: [kept.id, fresh.id], printerNote: "Zebra", defaultMarginPercent: 20,
    });
  });

  it("journalise aussi la marge par défaut", async () => {
    const admin = await asStaff("STAFF_ADMIN");
    await call({ templateIds: [], printerNote: null, defaultMarginPercent: 25 });
    const log = await prisma.activityLog.findFirst({
      where: { type: "PLATFORM_SETTINGS_UPDATED", userId: admin.id },
    });
    expect(log?.details).toMatchObject({ defaultMarginPercent: 25 });
  });
});
