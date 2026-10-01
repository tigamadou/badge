// Porte de pdfStudio (src/server/__tests__/migrate-v1.test.ts, commit 608bf3e), sans
// le bloc de parite de rendu dont les fixtures vivent dans le studio.
import { describe, it, expect } from "vitest";
import { migrateManifest } from "../migrate-v1";
import { parseManifest } from "@tigamadou/pdf-engine";

const V1 = {
  formatVersion: 1,
  family: "demo",
  label: "Badge demo",
  description: "Squelette v1.",
  page: { widthPx: 323.53, heightPx: 204.09, count: 1 },
  blocks: [
    { type: "rect", page: 1, x: 0, y: 174, w: 323.5, h: 30, fill: "category.color" },
    {
      type: "text",
      page: 1,
      x: 15,
      y: 23,
      w: 227,
      h: 30,
      text: "{participant.firstName} {participant.lastName}",
      style: { sizePx: 16, weight: 700, color: "#0f172a", overflow: "shrink", minSizePx: 11 },
      visibleIf: [{ path: "category.anonymous", equals: false }],
    },
    { type: "qr", page: 1, x: 242, y: 113, w: 60, h: 60 },
  ],
};

const ENTRIES: string[] = [];

describe("migrateManifest", () => {
  it("passe le manifeste en formatVersion 2", () => {
    const { manifest } = migrateManifest(V1, ENTRIES);
    expect((manifest as { formatVersion: number }).formatVersion).toBe(2);
  });

  it("declare les variables du domaine badge", () => {
    const { manifest } = migrateManifest(V1, ENTRIES);
    const names = (manifest as { variables: Array<{ name: string }> }).variables.map((v) => v.name);
    expect(names).toContain("participant.firstName");
    expect(names).toContain("category.color");
    expect(names).toContain("badge.qrCodeDataUrl");
    expect(names).toHaveLength(15);
  });

  it("convertit path en variable dans les conditions", () => {
    const { manifest } = migrateManifest(V1, ENTRIES);
    const block = (manifest as { blocks: Array<Record<string, unknown>> }).blocks[1];
    expect(block.visibleIf).toEqual([{ variable: "category.anonymous", equals: false }]);
  });

  it("convertit un bloc qr en rect portant une image", () => {
    const { manifest } = migrateManifest(V1, ENTRIES);
    const block = (manifest as { blocks: Array<Record<string, unknown>> }).blocks[2];
    expect(block.type).toBe("rect");
    expect(block.image).toEqual({ source: "badge.qrCodeDataUrl", fit: "contain" });
    expect(block.w).toBe(60);
  });

  it("produit un manifeste que le schema v2 accepte", () => {
    const { manifest } = migrateManifest(V1, ENTRIES);
    const result = parseManifest(manifest, ENTRIES);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it("n'attache un sample d'image que si la ressource existe", () => {
    const sans = migrateManifest(V1, []).manifest as { variables: Array<Record<string, unknown>> };
    expect(sans.variables.find((v) => v.name === "participant.photoDataUrl")?.sample).toBeUndefined();

    const avec = migrateManifest(V1, ["assets/photo-demo.png"]).manifest as {
      variables: Array<Record<string, unknown>>;
    };
    expect(avec.variables.find((v) => v.name === "participant.photoDataUrl")?.sample).toBe(
      "assets/photo-demo.png",
    );
  });

  it("convertit path en variable dans les conditions d'un enfant de groupe", () => {
    const avecGroupe = {
      ...V1,
      blocks: [
        {
          type: "group",
          page: 1,
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          blocks: [
            {
              type: "rect",
              x: 0,
              y: 0,
              w: 10,
              h: 10,
              fill: "category.color",
              visibleIf: [{ path: "category.anonymous", equals: false }],
            },
          ],
        },
      ],
    };
    const { manifest } = migrateManifest(avecGroupe, ENTRIES);
    const group = (manifest as { blocks: Array<Record<string, unknown>> }).blocks[0];
    const enfant = (group.blocks as Array<Record<string, unknown>>)[0];
    expect(enfant.visibleIf).toEqual([{ variable: "category.anonymous", equals: false }]);
  });

  it("convertit une condition unique sans la transformer en liste", () => {
    const avecConditionUnique = {
      ...V1,
      blocks: [{ ...V1.blocks[1], visibleIf: { path: "category.neutralBadge", equals: true } }],
    };
    const { manifest } = migrateManifest(avecConditionUnique, ENTRIES);
    const block = (manifest as { blocks: Array<Record<string, unknown>> }).blocks[0];
    expect(block.visibleIf).toEqual({ variable: "category.neutralBadge", equals: true });
  });

  it("rend compte de ce qu'elle a transforme", () => {
    const { notes } = migrateManifest(V1, ENTRIES);
    expect(notes.join(" ")).toMatch(/qr/);
  });

  it("refuse un manifeste qui n'est pas en v1", () => {
    expect(() => migrateManifest({ ...V1, formatVersion: 2 }, ENTRIES)).toThrow(/v1/);
  });
});

