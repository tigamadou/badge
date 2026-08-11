import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { SAMPLE_CONTEXT } from "../declarative/sample-context";
import { renderToJson } from "../declarative/__tests__/helpers/render-to-json";
import {
  resolveTemplate,
  listAvailableTemplates,
  templateExists,
  collidesWithRegistry,
} from "../resolve";
import { DEFAULT_TEMPLATE_ID } from "../index";

const LAYOUT = {
  formatVersion: 1,
  family: "salon",
  label: "Salon",
  description: "",
  page: { widthMm: 85.6, heightMm: 54, count: 1 },
  blocks: [{ type: "qr", page: 1, x: 0, y: 0, w: 10, h: 10 }],
};

async function install(
  overrides: Partial<{ family: string; version: number; archived: boolean; label: string }> = {},
) {
  return prisma.installedBadgeTemplate.create({
    data: {
      family: overrides.family ?? "salon",
      version: overrides.version ?? 1,
      label: overrides.label ?? "Salon",
      description: "",
      pages: 1,
      pageWidthMm: 85.6,
      pageHeightMm: 54,
      layout: LAYOUT,
      assetPrefix: "badge-templates/test/",
      formatVersion: 1,
      installedById: "u1",
      archived: overrides.archived ?? false,
    },
  });
}

describe("resolveTemplate", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("resout un identifiant du registre compile", async () => {
    const t = await resolveTemplate(DEFAULT_TEMPLATE_ID);
    expect(t.meta.id).toBe(DEFAULT_TEMPLATE_ID);
  });

  it("resout un template installe actif", async () => {
    const row = await install();
    const t = await resolveTemplate(row.id);
    expect(t.meta.label).toBe("Salon");
    expect(t.meta.id).toBe(row.id);
  });

  it("resout un template installe ARCHIVE, pour figer les badges existants", async () => {
    const row = await install({ archived: true });
    const t = await resolveTemplate(row.id);
    expect(t.meta.label).toBe("Salon");
  });

  it("expose l'apercu comme URL servable, pas comme cle de stockage", async () => {
    const row = await install();
    await prisma.installedBadgeTemplate.update({
      where: { id: row.id },
      data: { previewPath: "badge-templates/test/preview.pdf" },
    });
    const t = await resolveTemplate(row.id);
    // Une cle nue n'est pas affichable cote client : /api/files la sert.
    expect(t.meta.previewSrc).toBe("/api/files/badge-templates/test/preview.pdf");
  });

  it("charge les ressources du stockage pour un template qui en reference", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const ttf = Buffer.from([0x00, 0x01, 0x00, 0x00, 0, 0, 0, 0]);
    const prefix = `badge-templates/resolve-assets-${Date.now()}/`;
    await uploadFile(`${prefix}assets/fond.png`, png, "image/png");
    await uploadFile(`${prefix}fonts/A.ttf`, ttf, "font/ttf");

    const row = await prisma.installedBadgeTemplate.create({
      data: {
        family: "avec-assets",
        version: 1,
        label: "Avec ressources",
        description: "",
        pages: 1,
        pageWidthMm: 85.6,
        pageHeightMm: 54,
        layout: {
          formatVersion: 1,
          family: "avec-assets",
          label: "Avec ressources",
          description: "",
          page: { widthMm: 85.6, heightMm: 54, count: 1 },
          fonts: [{ alias: "titre", file: "fonts/A.ttf" }],
          blocks: [
            { type: "image", page: 1, x: 0, y: 0, w: 85.6, h: 54, asset: "assets/fond.png" },
          ],
        },
        assetPrefix: prefix,
        formatVersion: 1,
        installedById: "u1",
      },
    });

    const t = await resolveTemplate(row.id);
    expect(t.meta.label).toBe("Avec ressources");
    // Le rendu doit consommer les ressources prechargees : l'image de fond apparait
    // dans l'arbre sous forme de data URL, preuve que le stockage a bien ete lu.
    const rendu = renderToJson(t.Component, SAMPLE_CONTEXT);
    expect(rendu.images.some((src) => src.startsWith("data:image/png;base64,"))).toBe(true);
  });

  it("retombe sur le defaut pour un identifiant inconnu, en le signalant", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = await resolveTemplate("inconnu-xyz");
    expect(t.meta.id).toBe(DEFAULT_TEMPLATE_ID);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("inconnu-xyz"));
    warn.mockRestore();
  });
});

describe("templateExists", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("reconnait un identifiant du registre", async () => {
    expect(await templateExists(DEFAULT_TEMPLATE_ID)).toBe(true);
  });

  it("reconnait un template installe, meme archive", async () => {
    const row = await install({ archived: true });
    expect(await templateExists(row.id)).toBe(true);
  });

  it("rejette un identifiant inconnu, sans repli", async () => {
    expect(await templateExists("inconnu-xyz")).toBe(false);
  });
});

describe("listAvailableTemplates", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("inclut les templates du registre", async () => {
    const list = await listAvailableTemplates();
    expect(list.some((t) => t.id === DEFAULT_TEMPLATE_ID)).toBe(true);
  });

  it("exclut les templates archives", async () => {
    const row = await install({ archived: true });
    const list = await listAvailableTemplates();
    expect(list.some((t) => t.id === row.id)).toBe(false);
  });

  it("ne garde que la version la plus recente d'une famille", async () => {
    const v1 = await install({ version: 1, label: "V1" });
    const v2 = await install({ version: 2, label: "V2" });
    const list = await listAvailableTemplates();
    expect(list.some((t) => t.id === v2.id)).toBe(true);
    expect(list.some((t) => t.id === v1.id)).toBe(false);
  });

  it("expose la taille de page d'un template installe", async () => {
    const row = await install();
    const list = await listAvailableTemplates();
    const found = list.find((t) => t.id === row.id);
    expect(found?.pageSize).toEqual({ width: "85.6mm", height: "54mm" });
  });

  it("rend une chaine vide comme apercu tant qu'aucun n'est genere", async () => {
    const row = await install();
    const list = await listAvailableTemplates();
    expect(list.find((t) => t.id === row.id)?.previewSrc).toBe("");
  });
});

describe("collidesWithRegistry", () => {
  it("detecte une famille qui masquerait un template compile", () => {
    expect(collidesWithRegistry(DEFAULT_TEMPLATE_ID)).toBe(true);
  });

  it("laisse passer une famille libre", () => {
    expect(collidesWithRegistry("salon-2027")).toBe(false);
  });
});
