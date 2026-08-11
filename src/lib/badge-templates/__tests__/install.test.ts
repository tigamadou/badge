import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureReferenceTemplates, defaultTemplateId, installTemplate } from "../install";
import type { TemplateManifest } from "../declarative/manifest-types";

describe("ensureReferenceTemplates", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("installe les deux familles livrees avec l'application", async () => {
    await ensureReferenceTemplates("seed");
    const families = await prisma.installedBadgeTemplate.findMany({ select: { family: true } });
    expect(families.map((f) => f.family).sort()).toEqual(["default", "recto-verso"]);
  });

  it("genere un apercu pour chaque famille installee", async () => {
    await ensureReferenceTemplates("seed");
    const rows = await prisma.installedBadgeTemplate.findMany();
    for (const row of rows) {
      expect(row.previewPath).toBe(`badge-templates/${row.id}/preview.pdf`);
    }
  });

  it("est idempotent : deux executions ne creent pas de version supplementaire", async () => {
    await ensureReferenceTemplates("seed");
    await ensureReferenceTemplates("seed");
    expect(await prisma.installedBadgeTemplate.count()).toBe(2);
  });

  it("laisse intacte une famille deja installee", async () => {
    await ensureReferenceTemplates("seed");
    const before = await prisma.installedBadgeTemplate.findFirst({ where: { family: "default" } });
    await ensureReferenceTemplates("seed");
    const after = await prisma.installedBadgeTemplate.findFirst({ where: { family: "default" } });
    expect(after!.id).toBe(before!.id);
  });
});

describe("installTemplate", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("installe un manifeste accompagne de ses ressources", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const manifest: TemplateManifest = {
      formatVersion: 1,
      family: "avec-fond",
      label: "Avec fond",
      description: "",
      page: { widthMm: 85.6, heightMm: 54, count: 1 },
      blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 85.6, h: 54, asset: "assets/fond.png" }],
    };

    const created = await installTemplate({
      manifest,
      assets: [{ path: "assets/fond.png", body: png, contentType: "image/png" }],
      installedById: "u1",
    });

    expect(created.version).toBe(1);
    const row = await prisma.installedBadgeTemplate.findUnique({ where: { id: created.id } });
    expect(row?.assetPrefix).toBe(`badge-templates/${created.id}/`);
  });

  it("propage l'echec d'un rendu impossible", async () => {
    const manifest: TemplateManifest = {
      formatVersion: 1,
      family: "sans-ressource",
      label: "Sans ressource",
      description: "",
      page: { widthMm: 85.6, heightMm: 54, count: 1 },
      blocks: [{ type: "image", page: 1, x: 0, y: 0, w: 10, h: 10, asset: "assets/absent.png" }],
    };

    await expect(
      installTemplate({ manifest, assets: [], installedById: "u1" }),
    ).rejects.toBeDefined();
    expect(await prisma.installedBadgeTemplate.count()).toBe(0);
  });
});

describe("defaultTemplateId", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("rend null quand la famille default est absente", async () => {
    expect(await defaultTemplateId()).toBeNull();
  });

  it("rend la version la plus recente de la famille default", async () => {
    await ensureReferenceTemplates("seed");
    const id = await defaultTemplateId();
    const row = await prisma.installedBadgeTemplate.findUnique({ where: { id: id! } });
    expect(row?.family).toBe("default");
    expect(row?.version).toBe(1);
  });
});
