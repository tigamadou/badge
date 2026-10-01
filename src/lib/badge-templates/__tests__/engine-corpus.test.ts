import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { deleteFile, uploadFile } from "@/lib/storage";
import { exportEngineCorpus } from "../engine-corpus";

const LAYOUT = {
  formatVersion: 2,
  family: "salon",
  label: "Salon",
  description: "",
  category: "badge",
  page: { widthPx: 300, heightPx: 200, count: 1 },
  variables: [{ name: "photo", kind: "image", label: "Photo", sample: "assets/photo.png" }],
  blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 10, h: 10, image: { source: "photo" } }],
};

let out: string;

beforeEach(async () => {
  await prisma.installedBadgeTemplate.deleteMany({});
  out = mkdtempSync(join(tmpdir(), "corpus-"));
});

afterEach(async () => {
  rmSync(out, { recursive: true, force: true });
  await prisma.installedBadgeTemplate.deleteMany({ where: { family: "salon" } });
  for (const name of ["photo.png", "apercu.png"]) {
    await deleteFile(`badge-templates/corpus-salon/assets/${name}`).catch(() => {});
  }
});

async function installer(archived = false, extra: { layout?: object; formatVersion?: number; version?: number } = {}) {
  await uploadFile("badge-templates/corpus-salon/assets/photo.png", Buffer.from("IMG"), "image/png");
  return prisma.installedBadgeTemplate.create({
    data: {
      family: "salon",
      version: extra.version ?? 3,
      label: "Salon",
      description: "",
      pages: 1,
      pageWidthPx: 300,
      pageHeightPx: 200,
      layout: extra.layout ?? LAYOUT,
      bindings: {},
      assetPrefix: "badge-templates/corpus-salon/",
      formatVersion: extra.formatVersion ?? 2,
      installedById: "u1",
      archived,
    },
  });
}

describe("exportEngineCorpus", () => {
  it("ecrit un dossier par template avec son manifeste et ses ressources", async () => {
    await installer();
    const dirs = await exportEngineCorpus(out);
    expect(dirs).toEqual([join(out, "salon-v3")]);
    expect(JSON.parse(readFileSync(join(out, "salon-v3", "manifest.json"), "utf8"))).toEqual(LAYOUT);
    expect(readFileSync(join(out, "salon-v3", "assets", "photo.png")).toString()).toBe("IMG");
  });

  it("exporte aussi les templates archives", async () => {
    await installer(true);
    expect(await exportEngineCorpus(out)).toEqual([join(out, "salon-v3")]);
    expect(existsSync(join(out, "salon-v3", "manifest.json"))).toBe(true);
  });

  it("exporte l'apercu declare par le manifeste", async () => {
    await uploadFile("badge-templates/corpus-salon/assets/apercu.png", Buffer.from("APERCU"), "image/png");
    await installer(false, { layout: { ...LAYOUT, preview: "assets/apercu.png" } });
    await exportEngineCorpus(out);
    expect(readFileSync(join(out, "salon-v3", "assets", "apercu.png")).toString()).toBe("APERCU");
  });

  it("saute les templates au format v1 et ne retourne que les dossiers exportes", async () => {
    await installer(false, { formatVersion: 1, version: 1 });
    await installer(false, { version: 2 });
    expect(await exportEngineCorpus(out)).toEqual([join(out, "salon-v2")]);
    expect(existsSync(join(out, "salon-v1"))).toBe(false);
  });

  it("leve si une ressource manque au stockage", async () => {
    await installer();
    await deleteFile("badge-templates/corpus-salon/assets/photo.png");
    await expect(exportEngineCorpus(out)).rejects.toThrow(
      'export du corpus : ressource "assets/photo.png" de salon v3 absente du stockage.',
    );
  });
});
