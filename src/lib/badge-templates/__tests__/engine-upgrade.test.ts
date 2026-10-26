import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Prisma } from "@prisma/client";
import { migrateManifest } from "@tigamadou/pdf-engine";
import { prisma } from "@/lib/prisma";
import { fakeExporter } from "@/lib/__tests__/helpers/fake-exporter";
import { ExportError } from "@tigamadou/pdf-engine/export";
import { deleteFile, getFile, uploadFile } from "@/lib/storage";
import {
  BASELINE_KEY,
  ENGINE_VERSION,
  assetNamesFor,
  formatReport,
  loadBaseline,
  variantsOf,
  verifyEngineUpgrade,
  type UpgradeReport,
} from "../engine-upgrade";

const PNG = Buffer.from("IMG");

function layoutV2(texte = "Bonjour") {
  return {
    formatVersion: 2,
    family: "salon",
    label: "Salon",
    description: "",
    category: "badge",
    page: { widthPx: 300, heightPx: 200, count: 1 },
    variables: [
      { name: "nom", kind: "text", label: "Nom", sample: "Awa" },
      { name: "photo", kind: "image", label: "Photo", sample: "assets/photo.png" },
    ],
    presets: [{ label: "Sans photo", values: { photo: "" } }],
    blocks: [
      {
        type: "text",
        page: 1,
        x: 10,
        y: 10,
        w: 200,
        h: 30,
        text: `${texte} {nom}`,
        style: { sizePx: 12, color: "#000000", overflow: "clip" },
      },
      { type: "rect", page: 1, x: 10, y: 50, w: 40, h: 40, image: { source: "photo" } },
      { type: "rect", page: 1, x: 60, y: 50, w: 40, h: 40, image: { asset: "assets/fond.png" } },
    ],
  };
}

// Layout au format courant (3), derive du fixture historique par la migration du moteur.
function layout(texte = "Bonjour") {
  return migrateManifest(layoutV2(texte)) as Prisma.InputJsonObject;
}

async function installer(options: { family?: string; layout?: unknown; formatVersion?: number } = {}) {
  const family = options.family ?? "salon";
  const assetPrefix = `badge-templates/test-${family}/`;
  await uploadFile(`${assetPrefix}assets/photo.png`, PNG, "image/png");
  await uploadFile(`${assetPrefix}assets/fond.png`, PNG, "image/png");
  return prisma.installedBadgeTemplate.create({
    data: {
      family,
      version: 1,
      label: family,
      description: "",
      pages: 1,
      pageWidthPx: 300,
      pageHeightPx: 200,
      layout: (options.layout ?? layout()) as object,
      bindings: {},
      assetPrefix,
      formatVersion: options.formatVersion ?? 3,
      installedById: "u1",
    },
  });
}

const FAMILIES = ["salon", "casse", "ancien", "sansfond", "neuf", "apercu"];

async function nettoyer(tout = false) {
  await prisma.installedBadgeTemplate.deleteMany({ where: tout ? {} : { family: { in: FAMILIES } } });
  await deleteFile(BASELINE_KEY);
  for (const family of FAMILIES) {
    for (const name of ["assets/photo.png", "assets/fond.png", "assets/apercu.png"]) {
      await deleteFile(`badge-templates/test-${family}/${name}`).catch(() => {});
    }
  }
}

// Isolation : le test part d'une table vide (le seed est rejoue en fin de chantier).
beforeEach(() => nettoyer(true));
afterEach(() => nettoyer());

describe("assetNamesFor et variantsOf", () => {
  it("reunit ressources du layout, echantillons et valeurs de preset des variables image", () => {
    const manifest = layout() as never;
    expect(assetNamesFor(manifest)).toEqual(["assets/fond.png", "assets/photo.png"]);
  });

  it("rend les echantillons puis un jeu par preset", () => {
    const resolver = (name: string) => `data:${name}`;
    const variantes = variantsOf(layout() as never, resolver);
    expect(variantes.map((v) => v.name)).toEqual(["echantillons", "prereglage Sans photo"]);
    expect(variantes[0].values.photo).toBe("data:assets/photo.png");
    expect(variantes[1].values.photo).toBe("");
  });
});

describe("assetNamesFor et variantsOf : valeurs de preset variees", () => {
  function avecPresets() {
    const m = layout() as { variables: unknown[]; presets: unknown[] };
    m.variables.push(
      { name: "logo", kind: "image", label: "Logo", sample: "" },
      { name: "vip", kind: "boolean", label: "VIP", sample: false },
    );
    m.presets = [{ label: "Autre", values: { photo: "assets/autre.png", nom: "Zoe", vip: true, logo: "" } }];
    return m as never;
  }

  it("ajoute les images de preset et ignore les valeurs non image ou vides", () => {
    expect(assetNamesFor(avecPresets())).toEqual(["assets/autre.png", "assets/fond.png", "assets/photo.png"]);
  });

  it("resout les images de preset et laisse les autres valeurs telles quelles", () => {
    const variantes = variantsOf(avecPresets(), (name) => `data:${name}`);
    expect(variantes[1].values).toMatchObject({ photo: "data:assets/autre.png", nom: "Zoe", vip: true, logo: "" });
  });
});

describe("assetNamesFor : apercu", () => {
  it("inclut manifest.preview quand il est renseigne", () => {
    const manifest = { ...layout(), preview: "assets/apercu.png" } as never;
    expect(assetNamesFor(manifest)).toEqual(["assets/apercu.png", "assets/fond.png", "assets/photo.png"]);
  });
});

describe("assetNamesFor et variantsOf : sans preset", () => {
  it("fonctionne quand le manifeste n'a pas de prereglages", () => {
    const sansPresets: Record<string, unknown> = layout();
    delete sansPresets.presets;
    expect(assetNamesFor(sansPresets as never)).toEqual(["assets/fond.png", "assets/photo.png"]);
    expect(variantsOf(sansPresets as never, (n) => n).map((v) => v.name)).toEqual(["echantillons"]);
  });
});

describe("verifyEngineUpgrade", () => {
  it("sans reference : tout est sans reference, et rien n'est ecrit sans --accept", async () => {
    await installer();
    const report = await verifyEngineUpgrade({ accept: false });
    expect(report.fresh.map((t) => t.family)).toEqual(["salon"]);
    expect(report.baselineVersion).toBeNull();
    expect(report.baselineWritten).toBe(false);
    expect(await loadBaseline()).toBeNull();
  });

  it("--accept ecrit la reference ; une seconde verification ne voit aucun changement", async () => {
    await installer();
    const premier = await verifyEngineUpgrade({ accept: true });
    expect(premier.baselineWritten).toBe(true);
    const reference = await loadBaseline();
    expect(reference?.engineVersion).toBe(ENGINE_VERSION);

    const second = await verifyEngineUpgrade({ accept: false });
    expect(second.unchanged.map((t) => t.family)).toEqual(["salon"]);
    expect(second.changed).toEqual([]);
    expect(second.baselineVersion).toBe(ENGINE_VERSION);
  });

  it("un rendu different est signale et son epreuve regeneree a cote de l'ancienne", async () => {
    const row = await installer();
    await verifyEngineUpgrade({ accept: true });
    // Simule un moteur qui rend autrement : le layout stocke change de texte.
    await prisma.installedBadgeTemplate.update({ where: { id: row.id }, data: { layout: layout("Salut") } });

    const report = await verifyEngineUpgrade({ accept: false });
    expect(report.changed).toHaveLength(1);
    expect(report.changed[0].variants).toEqual(["echantillons", "prereglage Sans photo"]);
    expect(report.changed[0].proofPath).toBe(`${row.assetPrefix}proof-engine-${ENGINE_VERSION}.png`);
    const proof = await getFile(report.changed[0].proofPath);
    expect([...proof.body.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(proof.contentType).toBe("image/png");
  });

  it("refuse un layout illisible, une ressource absente ou un format v1, et n'ecrit pas la reference", async () => {
    await installer({ family: "casse", layout: { formatVersion: 3 } });
    await installer({ family: "ancien", formatVersion: 1 });
    const sansFond = await installer({ family: "sansfond" });
    await deleteFile(`${sansFond.assetPrefix}assets/fond.png`);

    const report = await verifyEngineUpgrade({ accept: true });
    expect(report.refused.map((t) => t.family).sort()).toEqual(["ancien", "casse", "sansfond"]);
    expect(report.refused.find((t) => t.family === "ancien")!.errors[0]).toMatch(
      /format v1.*make migrate-installed-templates/,
    );
    expect(report.refused.find((t) => t.family === "sansfond")!.errors).toEqual([
      'ressource "assets/fond.png" absente du stockage.',
    ]);
    expect(report.baselineWritten).toBe(false);
    expect(await loadBaseline()).toBeNull();
  });

  it("verifie une ligne restee au format 2 (migree en memoire) sans la refuser", async () => {
    const row = await installer({ layout: layoutV2(), formatVersion: 2 });
    const report = await verifyEngineUpgrade({ accept: false });
    expect(report.refused).toEqual([]);
    expect(report.fresh.map((t) => t.id)).toEqual([row.id]);
  });

  it("refuse un layout au format 2 que la migration ne sait pas lire", async () => {
    await installer({ family: "casse", layout: "illisible" as never, formatVersion: 2 });
    const report = await verifyEngineUpgrade({ accept: false });
    expect(report.refused[0].errors[0]).toMatch(/layout illisible/);
  });

  it("deux verifications donnent les memes empreintes, sans appeler le service", async () => {
    await installer();
    await verifyEngineUpgrade({ accept: true });
    const premiere = await loadBaseline();
    await verifyEngineUpgrade({ accept: true });
    expect((await loadBaseline())!.templates).toEqual(premiere!.templates);
    expect(fakeExporter.calls).toEqual([]);
  });

  it("une reference sans empreinte HTML (moteur 1.x) est d'un autre moteur : tout est sans reference, epreuve regeneree", async () => {
    const row = await installer();
    await uploadFile(
      BASELINE_KEY,
      Buffer.from(JSON.stringify({ engineVersion: "1.2.0", checkedAt: "x", templates: { [row.id]: { echantillons: "abc" } } })),
      "application/json",
    );
    const report = await verifyEngineUpgrade({ accept: false });
    expect(report.changed).toEqual([]);
    expect(report.fresh).toHaveLength(1);
    expect(report.fresh[0].proofPath).toBe(`${row.assetPrefix}proof-engine-${ENGINE_VERSION}.png`);
    const accepted = await verifyEngineUpgrade({ accept: true });
    expect(accepted.baselineWritten).toBe(true);
    expect((await loadBaseline())!.fingerprint).toBe("html");
  });

  it("rejette une ExportError quand le service manque pendant l'ecriture d'une epreuve", async () => {
    await installer();
    await verifyEngineUpgrade({ accept: true });
    await installer({ family: "neuf" });
    fakeExporter.failNext("UNAVAILABLE");
    await expect(verifyEngineUpgrade({ accept: false })).rejects.toBeInstanceOf(ExportError);
  });

  it("verifie aussi les templates archives (leurs badges deja emis restent rendables)", async () => {
    const row = await installer();
    await prisma.installedBadgeTemplate.update({ where: { id: row.id }, data: { archived: true } });
    const report = await verifyEngineUpgrade({ accept: false });
    expect(report.fresh.map((t) => t.id)).toEqual([row.id]);
  });

  it("avec une reference, un template installe depuis est sans reference et recoit son epreuve", async () => {
    await installer();
    await verifyEngineUpgrade({ accept: true });
    const neuf = await installer({ family: "neuf" });

    const report = await verifyEngineUpgrade({ accept: false });
    expect(report.fresh).toHaveLength(1);
    expect(report.fresh[0].id).toBe(neuf.id);
    expect(report.fresh[0].proofPath).toBe(`${neuf.assetPrefix}proof-engine-${ENGINE_VERSION}.png`);
    const proof = await getFile(report.fresh[0].proofPath!);
    expect([...proof.body.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("sans reference, les templates sans reference n'ont pas d'epreuve regeneree", async () => {
    await installer();
    const report = await verifyEngineUpgrade({ accept: false });
    expect(report.fresh[0].proofPath).toBeUndefined();
  });

  it("une ressource d'apercu du manifeste est verifiee et non refusee", async () => {
    const avecApercu = { ...layout(), preview: "assets/apercu.png" };
    const row = await installer({ family: "apercu", layout: avecApercu });
    await uploadFile(`${row.assetPrefix}assets/apercu.png`, PNG, "image/png");
    const report = await verifyEngineUpgrade({ accept: false });
    expect(report.refused).toEqual([]);
    expect(report.fresh.map((t) => t.id)).toEqual([row.id]);
  });

  it("refuse un template dont l'apercu declare est absent du stockage", async () => {
    await installer({ family: "apercu", layout: { ...layout(), preview: "assets/apercu.png" } });
    const report = await verifyEngineUpgrade({ accept: false });
    expect(report.refused[0].errors).toEqual(['ressource "assets/apercu.png" absente du stockage.']);
  });
});

describe("formatReport", () => {
  const base: UpgradeReport = {
    engineVersion: "1.1.0",
    baselineVersion: "1.0.0",
    refused: [],
    changed: [],
    unchanged: [],
    fresh: [],
    baselineWritten: false,
  };

  it("resume un rapport complet", () => {
    const texte = formatReport({
      ...base,
      refused: [{ id: "r1", family: "casse", version: 1, errors: ["a", "b"] }],
      changed: [
        { id: "c1", family: "salon", version: 2, variants: ["echantillons"], proofPath: "x/proof-engine-1.1.0.pdf" },
      ],
      unchanged: [{ id: "u1", family: "default", version: 1 }],
      fresh: [
        { id: "f1", family: "neuf", version: 1 },
        { id: "f2", family: "neuf", version: 2, proofPath: "y/proof-engine-1.1.0.pdf" },
      ],
    });
    expect(texte).toBe(
      [
        "Moteur @tigamadou/pdf-engine 1.1.0 (référence : 1.0.0)",
        "Refusés (bloquant) : 1",
        "  - casse v1 (r1) : a ; b",
        "Rendus changés (à examiner) : 1",
        "  - salon v2 (c1) : echantillons -> épreuve x/proof-engine-1.1.0.pdf",
        "Inchangés : 1",
        "Sans référence : 2",
        "  - neuf v1 (f1)",
        "  - neuf v2 (f2) -> épreuve y/proof-engine-1.1.0.pdf",
        "Référence non enregistrée (relancer avec --accept après examen).",
      ].join("\n"),
    );
  });

  it("signale l'absence de reference et une reference enregistree", () => {
    const texte = formatReport({ ...base, baselineVersion: null, baselineWritten: true });
    expect(texte.split("\n")[0]).toBe("Moteur @tigamadou/pdf-engine 1.1.0 (référence : aucune)");
    expect(texte.split("\n").at(-1)).toBe("Référence enregistrée.");
  });
});
