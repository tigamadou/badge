import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { parseManifest } from "@tigamadou/pdf-engine";
import { renderHtml } from "@tigamadou/pdf-engine/html";
import { montserratFaces } from "@tigamadou/pdf-engine/fonts";
import {
  resolveTemplate,
  listAvailableTemplates,
  templateExists,
  previewUrl,
  readLayout,
  referencedAssets,
  templateImageUrl,
} from "../resolve";
import type { BadgeTemplate } from "../types";
import { ensureReferenceTemplates, defaultTemplateId } from "../install";

function html(t: BadgeTemplate, values: Record<string, unknown> = {}): string {
  return renderHtml(t.manifest, {
    values: values as never,
    assets: t.assets,
    defaultFont: montserratFaces(),
  }).html;
}

const LAYOUT = {
  formatVersion: 3,
  family: "salon",
  label: "Salon",
  description: "",
  page: { widthPx: 1011, heightPx: 638, count: 1 },
  variables: [{ name: "badge.qrCodeDataUrl", kind: "image", label: "QR code" }],
  blocks: [
    { type: "rect", page: 1, x: 0, y: 0, w: 10, h: 10, image: { source: "badge.qrCodeDataUrl" } },
  ],
};

// Table de liaison complete pour LAYOUT : sans elle, chaque resolution journaliserait.
const BINDINGS = { "badge.qrCodeDataUrl": "badge.qrCodeDataUrl" };

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
      pageWidthPx: 1011,
      pageHeightPx: 638,
      layout: LAYOUT,
      bindings: BINDINGS,
      assetPrefix: "badge-templates/test/",
      formatVersion: 3,
      installedById: "u1",
      archived: overrides.archived ?? false,
    },
  });
}

describe("resolveTemplate", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("resout un template livre, installe par le seed", async () => {
    await ensureReferenceTemplates("seed");
    const id = (await defaultTemplateId())!;
    const t = await resolveTemplate(id);
    expect(t.meta.id).toBe(id);
    expect(t.meta.label).toBe("Badge standard");
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
      data: { previewPath: "badge-templates/test/preview.png" },
    });
    const t = await resolveTemplate(row.id);
    // Une cle nue n'est pas affichable cote client : /api/files la sert.
    expect(t.meta.previewSrc).toBe("/api/files/badge-templates/test/preview.png");
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
        pageWidthPx: 1011,
        pageHeightPx: 638,
        layout: {
          formatVersion: 3,
          family: "avec-assets",
          label: "Avec ressources",
          description: "",
          page: { widthPx: 1011, heightPx: 638, count: 1 },
          fonts: [{ alias: "titre", file: "fonts/A.ttf" }],
          variables: [],
          blocks: [
            { type: "rect", page: 1, x: 0, y: 0, w: 1011, h: 638, image: { asset: "assets/fond.png" } },
          ],
        },
        assetPrefix: prefix,
        formatVersion: 3,
        installedById: "u1",
      },
    });

    const t = await resolveTemplate(row.id);
    expect(t.meta.label).toBe("Avec ressources");
    // Le rendu doit consommer les ressources prechargees : l'image de fond apparait
    // dans l'arbre sous forme de data URL, preuve que le stockage a bien ete lu.
    expect(t.assets("assets/fond.png")).toBe(`data:image/png;base64,${png.toString("base64")}`);
    expect(html(t)).toContain(t.assets("assets/fond.png"));
  });

  it("expose les variables du manifeste et la table de liaison stockee", async () => {
    const row = await install();
    const t = await resolveTemplate(row.id);
    expect(t.variables).toEqual(LAYOUT.variables);
    expect(t.bindings).toEqual(BINDINGS);
  });

  it("journalise une table de liaison incomplete sans echouer", async () => {
    const { id } = await install();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // Ligne installee puis videe de ses liaisons : on veut un badge imprime et
    // un avertissement, jamais une exception.
    await prisma.installedBadgeTemplate.update({ where: { id }, data: { bindings: {} } });
    const template = await resolveTemplate(id);
    expect(template.bindings).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("liaisons incompletes"));
    warn.mockRestore();
  });

  it("traite une table de liaison JSON null comme une table vide", async () => {
    const { id } = await install();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // La colonne est NOT NULL, mais la valeur JSON `null` y reste possible (ecriture
    // hors Prisma) : le rendu doit tenir, avec un avertissement.
    await prisma.$executeRaw`UPDATE InstalledBadgeTemplate SET bindings = CAST('null' AS JSON) WHERE id = ${id}`;
    const template = await resolveTemplate(id);
    expect(template.bindings).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("liaisons incompletes"));
    warn.mockRestore();
  });

  it.each([
    ["un scalaire", 42],
    ["une chaine", "badge.id"],
    ["un tableau", ["badge.qrCodeDataUrl"]],
  ])("traite une table de liaison qui est %s comme une table vide", async (_label, value) => {
    const { id } = await install();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // Un tableau passerait `typeof === "object"` : il doit lui aussi etre ecarte,
    // sinon ses indices seraient pris pour des noms de variables.
    await prisma.installedBadgeTemplate.update({ where: { id }, data: { bindings: value } });
    const template = await resolveTemplate(id);
    expect(template.bindings).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("liaisons incompletes"));
    warn.mockRestore();
  });

  it("refuse explicitement une ligne restee au format v1, en nommant la migration", async () => {
    const { id } = await install();
    await prisma.installedBadgeTemplate.update({ where: { id }, data: { formatVersion: 1 } });
    await expect(resolveTemplate(id)).rejects.toThrow(/format v1.*make migrate-installed-templates/);
  });

  it("expose meta depuis la ligne installee", async () => {
    const row = await install();
    await prisma.installedBadgeTemplate.update({
      where: { id: row.id },
      data: { pageWidthPx: 320, pageHeightPx: 460, description: "Desc" },
    });
    const t = await resolveTemplate(row.id);
    expect(t.meta).toEqual({
      id: row.id,
      version: 1,
      label: "Salon",
      description: "Desc",
      pages: 1,
      pageSize: { width: "320px", height: "460px" },
      previewSrc: "",
    });
  });

  it("migre en memoire une ligne restee au format 2", async () => {
    const { id } = await install();
    await prisma.installedBadgeTemplate.update({
      where: { id },
      data: { formatVersion: 2, layout: { ...LAYOUT, formatVersion: 2 } },
    });
    const t = await resolveTemplate(id);
    expect(t.manifest.formatVersion).toBe(3);
  });

  it("precharge une ressource posee dans un groupe imbrique", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const prefix = `badge-templates/resolve-groupe-${Date.now()}/`;
    await uploadFile(`${prefix}assets/fond.png`, png, "image/png");

    const row = await prisma.installedBadgeTemplate.create({
      data: {
        family: "groupe",
        version: 1,
        label: "Groupe",
        description: "",
        pages: 1,
        pageWidthPx: 1011,
        pageHeightPx: 638,
        layout: {
          formatVersion: 3,
          family: "groupe",
          label: "Groupe",
          description: "",
          page: { widthPx: 1011, heightPx: 638, count: 1 },
          variables: [],
          blocks: [
            {
              type: "group",
              page: 1,
              x: 0,
              y: 0,
              w: 500,
              h: 500,
              blocks: [
                {
                  type: "group",
                  x: 10,
                  y: 10,
                  w: 200,
                  h: 200,
                  blocks: [
                    { type: "square", x: 0, y: 0, w: 50, h: 50, image: { asset: "assets/fond.png" } },
                    { type: "rect", x: 60, y: 0, w: 50, h: 50, fill: "#ff0000" },
                  ],
                },
              ],
            },
          ],
        },
        bindings: {},
        assetPrefix: prefix,
        formatVersion: 3,
        installedById: "u1",
      },
    });

    // Avant correction, la ressource d'un enfant de groupe n'etait pas prechargee :
    // le rendu levait « ressource absente du stockage ».
    const t = await resolveTemplate(row.id);
    expect(html(t)).toContain(t.assets("assets/fond.png"));
  });

  it("retombe sur la famille default pour un identifiant inconnu, en le signalant", async () => {
    await ensureReferenceTemplates("seed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = await resolveTemplate("inconnu-xyz");
    expect(t.meta.id).toBe(await defaultTemplateId());
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("inconnu-xyz"));
    warn.mockRestore();
  });

  it("leve explicitement si aucune famille default n'existe", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Base sans seed : mieux vaut echouer bruyamment qu'imprimer un badge vide.
    await expect(resolveTemplate("inconnu-xyz")).rejects.toThrow(/make db-seed/);
    warn.mockRestore();
  });

  it("precharge l'image d'une puce de liste", async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
    await uploadFile("badge-templates/puce/assets/puce.png", Buffer.from("PUCE"), "image/png");
    const row = await prisma.installedBadgeTemplate.create({
      data: {
        family: "consignes",
        version: 1,
        label: "Consignes",
        description: "",
        pages: 1,
        pageWidthPx: 300,
        pageHeightPx: 200,
        layout: {
          formatVersion: 3,
          family: "consignes",
          label: "Consignes",
          description: "",
          category: "badge",
          page: { widthPx: 300, heightPx: 200, count: 1 },
          variables: [{ name: "consignes", kind: "list", label: "Consignes", sample: ["Un"] }],
          blocks: [
            {
              type: "list",
              page: 1,
              x: 10,
              y: 10,
              w: 200,
              h: 100,
              source: "consignes",
              bullet: { type: "image", sizePx: 8, gapPx: 4, asset: "assets/puce.png" },
              items: { maxItems: 5, maxChars: 100, maxLines: 2, lineHeightPx: 12 },
              style: { sizePx: 10, color: "#000000" },
            },
          ],
        },
        bindings: { consignes: null },
        assetPrefix: "badge-templates/puce/",
        formatVersion: 3,
        installedById: "u1",
      },
    });

    const template = await resolveTemplate(row.id);
    const out = html(template, { consignes: ["Restez dans la zone."] });
    expect(out).toContain("Restez dans la zone.");
    expect(out).toContain(`data:image/png;base64,${Buffer.from("PUCE").toString("base64")}`);
  });

  it("ne precharge rien pour une puce qui n'est pas une image", async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
    const row = await prisma.installedBadgeTemplate.create({
      data: {
        family: "consignes",
        version: 1,
        label: "Consignes",
        description: "",
        pages: 1,
        pageWidthPx: 300,
        pageHeightPx: 200,
        layout: {
          formatVersion: 3,
          family: "consignes",
          label: "Consignes",
          description: "",
          category: "badge",
          page: { widthPx: 300, heightPx: 200, count: 1 },
          variables: [{ name: "consignes", kind: "list", label: "Consignes", sample: ["Un"] }],
          blocks: [
            {
              type: "list",
              page: 1,
              x: 10,
              y: 10,
              w: 200,
              h: 100,
              source: "consignes",
              bullet: { type: "disc", sizePx: 3, gapPx: 4, color: "#000000" },
              items: { maxItems: 5, maxChars: 100, maxLines: 2, lineHeightPx: 12 },
              style: { sizePx: 10, color: "#000000" },
            },
          ],
        },
        bindings: { consignes: null },
        assetPrefix: "badge-templates/puce/",
        formatVersion: 3,
        installedById: "u1",
      },
    });

    const template = await resolveTemplate(row.id);
    const out = html(template, { consignes: ["Restez dans la zone."] });
    expect(out).toContain("Restez dans la zone.");
    expect(out).not.toContain("data:image/");
  });
});

describe("readLayout", () => {
  it("renvoie un layout au format 3 tel quel", () => {
    expect(readLayout({ id: "x", formatVersion: 3, layout: LAYOUT })).toBe(LAYOUT);
  });

  it("migre un layout au format 2 vers le format 3, blocs identiques", () => {
    const layout = { ...LAYOUT, formatVersion: 2 };
    const out = readLayout({ id: "x", formatVersion: 2, layout });
    expect(out.formatVersion).toBe(3);
    expect(out.blocks).toEqual(LAYOUT.blocks);
    expect(layout.formatVersion).toBe(2);
  });

  it("refuse le format 1 en nommant la migration", () => {
    expect(() => readLayout({ id: "x", formatVersion: 1, layout: LAYOUT })).toThrow(
      /format v1.*make migrate-installed-templates/,
    );
  });
});

describe("referencedAssets", () => {
  const base = {
    formatVersion: 3,
    family: "f",
    label: "F",
    description: "",
    category: "badge",
    page: { widthPx: 100, heightPx: 100, count: 1 },
    variables: [],
  };
  const parse = (blocks: unknown[], entries: string[] = []) => {
    const r = parseManifest(
      { ...base, blocks: blocks.map((b) => ({ page: 1, ...(b as object) })) },
      entries,
    );
    if (!r.ok) throw new Error(r.errors.join(" | "));
    return r.manifest;
  };

  it("ne reference rien pour un rect a fond uni, et la ressource d'un rect a image", () => {
    const plain = parse([{ type: "rect", x: 0, y: 0, w: 10, h: 10, fill: "#ff0000" }]);
    expect(referencedAssets(plain)).toEqual([]);
    const withImage = parse(
      [{ type: "rect", x: 0, y: 0, w: 10, h: 10, image: { asset: "assets/fond.png" } }],
      ["assets/fond.png"],
    );
    expect(referencedAssets(withImage)).toEqual(["assets/fond.png"]);
  });

  it("couvre l'ellipse (y compris dans un groupe) et ignore line, polygon et path", () => {
    const m = parse(
      [
        {
          type: "group",
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          blocks: [{ type: "ellipse", x: 0, y: 0, w: 10, h: 10, image: { asset: "assets/motif.png" } }],
        },
        { type: "line", x1: 0, y1: 0, x2: 10, y2: 10, stroke: { color: "#000000", widthPx: 1 } },
        { type: "polygon", x: 0, y: 0, w: 10, h: 10, sides: 5, fill: "#000000" },
        { type: "path", x: 0, y: 0, w: 10, h: 10, d: "M 0 0 L 10 10", fill: "#000000" },
      ],
      ["assets/motif.png"],
    );
    expect(referencedAssets(m)).toEqual(["assets/motif.png"]);
  });
});

describe("templateExists", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("reconnait un template livre installe par le seed", async () => {
    await ensureReferenceTemplates("seed");
    expect(await templateExists((await defaultTemplateId())!)).toBe(true);
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

  it("inclut les templates livres une fois le seed passe, avec leur epreuve PNG pour vignette", async () => {
    await ensureReferenceTemplates("seed");
    const list = await listAvailableTemplates();
    expect(list.map((t) => t.label)).toContain("Badge standard");
    for (const t of list) expect(t.previewSrc).toMatch(/\/proof\.png$/);
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
    expect(found?.pageSize).toEqual({ width: "1011px", height: "638px" });
  });

  it("rend une chaine vide comme apercu tant qu'aucun n'est genere", async () => {
    const row = await install();
    const list = await listAvailableTemplates();
    expect(list.find((t) => t.id === row.id)?.previewSrc).toBe("");
  });
});

describe("templateImageUrl", () => {
  it("prefere l'image du paquet pour le catalogue et l'epreuve pour le detail", () => {
    const row = { previewPath: "p/a.png", proofPath: "p/proof.png" };
    expect(templateImageUrl(row, "preview")).toBe("/api/files/p/a.png");
    expect(templateImageUrl(row, "proof")).toBe("/api/files/p/proof.png");
  });

  it("se replie sur l'epreuve quand le paquet n'a pas d'image", () => {
    expect(templateImageUrl({ previewPath: null, proofPath: "p/proof.png" }, "preview")).toBe(
      "/api/files/p/proof.png",
    );
  });

  it("ignore une epreuve .pdf d'avant la migration", () => {
    expect(templateImageUrl({ previewPath: null, proofPath: "p/proof.pdf" }, "preview")).toBe("");
    expect(templateImageUrl({ previewPath: null, proofPath: null }, "proof")).toBe("");
  });

  it("accepte jpg, jpeg et webp", () => {
    for (const ext of ["jpg", "jpeg", "webp"]) {
      expect(templateImageUrl({ previewPath: `p/a.${ext}`, proofPath: null }, "preview")).toBe(`/api/files/p/a.${ext}`);
    }
  });
});

describe("previewUrl", () => {
  it("prefixe un chemin de stockage par la route de service", () => {
    expect(previewUrl("badge-templates/x/preview.pdf")).toBe(
      "/api/files/badge-templates/x/preview.pdf",
    );
  });

  it("rend une chaine vide quand aucun apercu n'existe", () => {
    expect(previewUrl(null)).toBe("");
  });
});
