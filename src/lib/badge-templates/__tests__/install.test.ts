import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureReferenceTemplates, defaultTemplateId, installTemplate } from "../install";
import type { TemplateManifest } from "@tigamadou/pdf-engine";

// Manifeste v2 de reference : une variable au nom de source, une au nom libre.
const manifest: TemplateManifest = {
  formatVersion: 2,
  family: "salon-2027",
  label: "Badge Salon",
  description: "Un badge de test.",
  category: "badge",
  page: { widthPx: 1011, heightPx: 638, count: 1 },
  variables: [
    { name: "participant.firstName", kind: "text", label: "Prénom", sample: "Awa" },
    { name: "structure", kind: "text", label: "Structure", sample: "Organisation" },
  ],
  blocks: [
    {
      type: "text",
      page: 1,
      x: 4,
      y: 4,
      w: 400,
      h: 60,
      text: "{participant.firstName} — {structure}",
      style: { sizePx: 50, color: "#0f172a", overflow: "clip" },
    },
  ],
};

// Table de liaison complete pour ce fixture.
const BINDINGS = { "participant.firstName": "participant.firstName", structure: "participant.structure" };

describe("ensureReferenceTemplates", () => {
  beforeEach(async () => {
    await prisma.installedBadgeTemplate.deleteMany({});
  });

  it("installe les deux familles livrees avec l'application", async () => {
    await ensureReferenceTemplates("seed");
    const families = await prisma.installedBadgeTemplate.findMany({ select: { family: true } });
    expect(families.map((f) => f.family).sort()).toEqual(["default", "recto-verso"]);
  });

  it("produit un PDF d'epreuve pour chaque famille installee", async () => {
    await ensureReferenceTemplates("seed");
    const rows = await prisma.installedBadgeTemplate.findMany();
    for (const row of rows) {
      expect(row.proofPath).toBe(`badge-templates/${row.id}/proof.pdf`);
      // Les paquets livres ne fournissent pas d'image : le catalogue montre le
      // placeholder tant qu'aucune n'est deposee.
      expect(row.previewPath).toBeNull();
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
    const avecFond: TemplateManifest = {
      formatVersion: 2,
      family: "avec-fond",
      label: "Avec fond",
      description: "",
      category: "badge",
      page: { widthPx: 1011, heightPx: 638, count: 1 },
      variables: [],
      blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 1011, h: 638, image: { asset: "assets/fond.png" } }],
    };

    const created = await installTemplate({
      manifest: avecFond,
      assets: [{ path: "assets/fond.png", body: png, contentType: "image/png" }],
      bindings: {},
      installedById: "u1",
    });

    expect(created.version).toBe(1);
    const row = await prisma.installedBadgeTemplate.findUnique({ where: { id: created.id } });
    expect(row?.assetPrefix).toBe(`badge-templates/${created.id}/`);
  });

  it("stocke l'image d'apercu declaree et le PDF d'epreuve separement", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const created = await installTemplate({
      manifest: { ...manifest, preview: "assets/apercu.png" },
      assets: [{ path: "assets/apercu.png", body: png, contentType: "image/png" }],
      bindings: BINDINGS,
      installedById: "u1",
    });

    const row = await prisma.installedBadgeTemplate.findUnique({ where: { id: created.id } });
    expect(row?.previewPath).toBe(`badge-templates/${created.id}/assets/apercu.png`);
    expect(row?.proofPath).toBe(`badge-templates/${created.id}/proof.pdf`);
  });

  it("laisse previewPath nul quand le paquet ne declare pas d'apercu", async () => {
    const created = await installTemplate({ manifest, assets: [], bindings: BINDINGS, installedById: "u1" });

    const row = await prisma.installedBadgeTemplate.findUnique({ where: { id: created.id } });
    expect(row?.previewPath).toBeNull();
    // Le PDF est produit meme sans apercu : c'est la preuve que le paquet s'imprime.
    expect(row?.proofPath).toBe(`badge-templates/${created.id}/proof.pdf`);
  });

  it("propage l'echec d'un rendu impossible", async () => {
    const sansRessource: TemplateManifest = {
      formatVersion: 2,
      family: "sans-ressource",
      label: "Sans ressource",
      description: "",
      category: "badge",
      page: { widthPx: 1011, heightPx: 638, count: 1 },
      variables: [],
      blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 10, h: 10, image: { asset: "assets/absent.png" } }],
    };

    await expect(
      installTemplate({ manifest: sansRessource, assets: [], bindings: {}, installedById: "u1" }),
    ).rejects.toBeDefined();
    expect(await prisma.installedBadgeTemplate.count()).toBe(0);
  });

  it("refuse une table de liaison incomplete", async () => {
    await expect(
      installTemplate({ manifest, assets: [], bindings: {}, installedById: "u1" }),
    ).rejects.toThrow(/aucune source choisie/);
  });

  it("stocke la table de liaison", async () => {
    const bindings = Object.fromEntries(manifest.variables.map((v) => [v.name, null]));
    const created = await installTemplate({ manifest, assets: [], bindings, installedById: "u1" });
    const row = await prisma.installedBadgeTemplate.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.bindings).toEqual(bindings);
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
