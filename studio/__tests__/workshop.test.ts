import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveAsset } from "../workshop";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const TTF = Buffer.from([0x00, 0x01, 0x00, 0x00, 0, 0, 0, 0]);

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "studio-workshop-"));
  await mkdir(join(root, "t1"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("saveAsset", () => {
  it("enregistre une image sniffee dans assets/", async () => {
    const saved = await saveAsset(root, "t1", "assets", "fond.png", PNG);
    expect(saved).toEqual({ ok: true, path: "assets/fond.png" });
    await expect(readFile(join(root, "t1", "assets", "fond.png"))).resolves.toBeDefined();
  });

  it("refuse un fichier au contenu non reconnu", async () => {
    const saved = await saveAsset(root, "t1", "assets", "note.txt", Buffer.from("bonjour"));
    expect(saved.ok).toBe(false);
  });

  it("refuse un webp renomme en png dans assets/", async () => {
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);
    expect((await saveAsset(root, "t1", "assets", "fond.png", webp)).ok).toBe(false);
  });

  it("refuse un nom de fichier traversant", async () => {
    expect((await saveAsset(root, "t1", "assets", "../evil.png", PNG)).ok).toBe(false);
  });

  it("refuse une police dans assets/ et accepte dans fonts/", async () => {
    expect((await saveAsset(root, "t1", "assets", "police.ttf", TTF)).ok).toBe(false);
    expect((await saveAsset(root, "t1", "fonts", "InterVar.ttf", TTF)).ok).toBe(true);
  });

  it("refuse un template inconnu ou un nom de template invalide", async () => {
    expect((await saveAsset(root, "inconnu", "assets", "fond.png", PNG)).ok).toBe(false);
    expect((await saveAsset(root, "Pas Valide", "assets", "fond.png", PNG)).ok).toBe(false);
  });
});
