import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isValidTemplateName,
  listTemplates,
  readTemplate,
  writeManifest,
} from "../workshop";

// Un PNG 1x1 valide : sert a verifier que le type est deduit des octets d'en-tete.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "studio-workshop-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("isValidTemplateName", () => {
  it("accepte un slug", () => {
    expect(isValidTemplateName("salon-2027")).toBe(true);
    expect(isValidTemplateName("default")).toBe(true);
  });

  it("refuse tout ce qui n'est pas un slug", () => {
    for (const name of ["", "../escape", "Salon", "a--b", "-a", "a-", "a/b", "a b"]) {
      expect(isValidTemplateName(name)).toBe(false);
    }
  });
});

describe("listTemplates", () => {
  it("liste les dossiers de l'atelier et signale la presence du manifeste", async () => {
    await mkdir(join(root, "avec-manifeste"));
    await writeFile(join(root, "avec-manifeste", "manifest.json"), "{}");
    await mkdir(join(root, "sans-manifeste"));
    await writeFile(join(root, "fichier-isole.txt"), "x");

    expect(await listTemplates(root)).toEqual([
      { name: "avec-manifeste", hasManifest: true },
      { name: "sans-manifeste", hasManifest: false },
    ]);
  });

  it("renvoie une liste vide quand l'atelier n'existe pas", async () => {
    expect(await listTemplates(join(root, "absent"))).toEqual([]);
  });
});

describe("readTemplate", () => {
  it("rend le manifeste en texte brut et les ressources typees par leurs octets", async () => {
    await mkdir(join(root, "salon", "assets"), { recursive: true });
    await writeFile(join(root, "salon", "manifest.json"), '{\n  "family": "salon"\n}');
    // Extension mensongere : le type doit venir des octets, donc image/png.
    await writeFile(join(root, "salon", "assets", "fond.jpg"), PNG_1PX);

    const read = await readTemplate(root, "salon");

    expect(read?.manifest).toBe('{\n  "family": "salon"\n}');
    expect(read?.assets).toEqual([
      { path: "assets/fond.jpg", body: expect.any(Buffer), contentType: "image/png" },
    ]);
  });

  it("ignore une ressource dont le type est indetectable", async () => {
    await mkdir(join(root, "salon", "assets"), { recursive: true });
    await writeFile(join(root, "salon", "manifest.json"), "{}");
    await writeFile(join(root, "salon", "assets", "note.txt"), "pas une image");

    const read = await readTemplate(root, "salon");

    expect(read?.assets).toEqual([]);
  });

  it("renvoie null pour un nom invalide ou un dossier absent", async () => {
    expect(await readTemplate(root, "../escape")).toBeNull();
    expect(await readTemplate(root, "inconnu")).toBeNull();
  });
});

describe("writeManifest", () => {
  it("ecrit le manifeste tel quel", async () => {
    await mkdir(join(root, "salon"));
    await writeFile(join(root, "salon", "manifest.json"), "{}");

    expect(await writeManifest(root, "salon", '{\n  "a": 1\n}')).toBe(true);
    expect(await readFile(join(root, "salon", "manifest.json"), "utf8")).toBe('{\n  "a": 1\n}');
  });

  it("refuse un nom invalide ou un dossier absent", async () => {
    expect(await writeManifest(root, "../escape", "{}")).toBe(false);
    expect(await writeManifest(root, "inconnu", "{}")).toBe(false);
  });
});
