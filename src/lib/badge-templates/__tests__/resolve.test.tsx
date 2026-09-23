import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";
import { renderToJson } from "../engine/declarative/__tests__/helpers/render-to-json";
import { resolveTemplate, listAvailableTemplates, templateExists, previewUrl } from "../resolve";
import { ensureReferenceTemplates, defaultTemplateId } from "../install";

const LAYOUT = {
  formatVersion: 2,
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
      formatVersion: 2,
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
        pageWidthPx: 1011,
        pageHeightPx: 638,
        layout: {
          formatVersion: 2,
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
        formatVersion: 2,
        installedById: "u1",
      },
    });

    const t = await resolveTemplate(row.id);
    expect(t.meta.label).toBe("Avec ressources");
    // Le rendu doit consommer les ressources prechargees : l'image de fond apparait
    // dans l'arbre sous forme de data URL, preuve que le stockage a bien ete lu.
    const rendu = renderToJson(<t.Component values={{}} />);
    expect(rendu.images.some((src) => src.startsWith("data:image/png;base64,"))).toBe(true);
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
          formatVersion: 2,
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
        formatVersion: 2,
        installedById: "u1",
      },
    });

    // Avant correction, la ressource d'un enfant de groupe n'etait pas prechargee :
    // le rendu levait « ressource absente du stockage ».
    const t = await resolveTemplate(row.id);
    const rendu = renderToJson(<t.Component values={{}} />);
    expect(rendu.images.some((src) => src.startsWith("data:image/png;base64,"))).toBe(true);
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

  it("inclut les templates livres une fois le seed passe", async () => {
    await ensureReferenceTemplates("seed");
    const list = await listAvailableTemplates();
    expect(list.map((t) => t.label)).toContain("Badge standard");
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
