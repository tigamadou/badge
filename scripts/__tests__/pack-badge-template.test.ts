import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { packTemplate } from "../pack-badge-template";
import { readTemplatePackage } from "@tigamadou/pdf-engine/package";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
let racine: string;

// Dossier de travail v2 minimal, ecrit par le test : les paquets sont desormais
// crees dans pdfStudio, ce depot n'a plus de generateur de squelette.
function createSkeleton(name: string, root: string): string {
  const dir = join(root, name);
  mkdirSync(join(dir, "assets"), { recursive: true });
  const manifest = {
    formatVersion: 2,
    family: name,
    label: `Badge ${name}`,
    description: "Un badge de test.",
    preview: "assets/apercu.png",
    page: { widthPx: 323.53, heightPx: 204.09, count: 1 },
    variables: [{ name: "participant.firstName", kind: "text", label: "Prénom", sample: "Awa" }],
    blocks: [
      {
        type: "text",
        page: 1,
        x: 15,
        y: 23,
        w: 227,
        h: 30,
        text: "{participant.firstName}",
        style: { sizePx: 16, color: "#0f172a", overflow: "clip" },
      },
    ],
  };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return dir;
}

afterEach(() => {
  if (racine && existsSync(racine)) rmSync(racine, { recursive: true, force: true });
});

describe("packTemplate", () => {
  it("produit une archive installable depuis un squelette complete", async () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);
    writeFileSync(join(dir, "assets", "apercu.png"), PNG);

    const zip = await packTemplate("salon-2027", racine);
    expect(existsSync(zip)).toBe(true);

    // L'archive produite doit franchir exactement les controles du televersement.
    const lu = await readTemplatePackage(readFileSync(zip));
    expect(lu.ok, lu.ok === false ? lu.errors.join(" | ") : "").toBe(true);
    expect(lu.ok === true && lu.manifest.family).toBe("salon-2027");
    expect(lu.ok === true && lu.manifest.preview).toBe("assets/apercu.png");
  });

  it("signale un apercu declare mais absent du dossier", async () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    createSkeleton("salon-2027", racine);
    // L'image n'a pas ete deposee : le squelette la declare pourtant.
    await expect(packTemplate("salon-2027", racine)).rejects.toThrow(/apercu/i);
  });

  it("refuse d'empaqueter un manifeste invalide", async () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ formatVersion: 9 }));

    await expect(packTemplate("salon-2027", racine)).rejects.toThrow(/invalide/i);
  });

  it("refuse un manifeste illisible", async () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);
    writeFileSync(join(dir, "manifest.json"), "{ pas du json");

    await expect(packTemplate("salon-2027", racine)).rejects.toThrow(/illisible/i);
  });

  it("refuse d'empaqueter un dossier inexistant", async () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    await expect(packTemplate("absent", racine)).rejects.toThrow(/introuvable/i);
  });

  it("embarque les polices deposees", async () => {
    racine = mkdtempSync(join(tmpdir(), "bt-"));
    const dir = createSkeleton("salon-2027", racine);
    writeFileSync(join(dir, "assets", "apercu.png"), PNG);

    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    manifest.fonts = [{ alias: "titre", file: "fonts/A.ttf" }];
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
    mkdirSync(join(dir, "fonts"));
    writeFileSync(join(dir, "fonts", "A.ttf"), Buffer.from([0x00, 0x01, 0x00, 0x00, 0, 0, 0, 0]));

    const zip = await packTemplate("salon-2027", racine);
    const lu = await readTemplatePackage(readFileSync(zip));
    expect(lu.ok, lu.ok === false ? lu.errors.join(" | ") : "").toBe(true);
    expect(lu.ok === true && lu.assets.map((a) => a.path).sort()).toEqual([
      "assets/apercu.png",
      "fonts/A.ttf",
    ]);
  });
});
