import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packFromStudio } from "../pack";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

const MANIFEST = {
  formatVersion: 1,
  family: "salon",
  label: "Salon",
  description: "",
  preview: "assets/apercu.png",
  page: { widthPx: 323.53, heightPx: 204.09, count: 1 },
  blocks: [
    {
      type: "text",
      page: 1,
      x: 10,
      y: 10,
      w: 200,
      h: 30,
      text: "{participant.firstName}",
      style: { sizePx: 16, color: "#0f172a", overflow: "clip" },
    },
  ],
};

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "studio-pack-"));
  await mkdir(join(root, "salon", "assets"), { recursive: true });
  await writeFile(join(root, "salon", "assets", "apercu.png"), PNG);
  await writeFile(join(root, "salon", "manifest.json"), JSON.stringify(MANIFEST));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("packFromStudio", () => {
  it("produit une archive zip", async () => {
    const res = await packFromStudio(root, "salon", JSON.stringify(MANIFEST));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.zip.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("enregistre le manifeste avant d'empaqueter", async () => {
    const modifie = { ...MANIFEST, label: "Nouveau libelle" };
    const res = await packFromStudio(root, "salon", JSON.stringify(modifie));
    expect(res.ok).toBe(true);
    const written = JSON.parse(await readFile(join(root, "salon", "manifest.json"), "utf8"));
    expect(written.label).toBe("Nouveau libelle");
  });

  it("remonte les erreurs d'un manifeste invalide", async () => {
    const invalide = { ...MANIFEST, blocks: [{ ...MANIFEST.blocks[0], text: "{participant.zzz}" }] };
    const res = await packFromStudio(root, "salon", JSON.stringify(invalide));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.join(" ")).toMatch(/source inconnue/);
  });

  it("remonte un JSON illisible", async () => {
    const res = await packFromStudio(root, "salon", "{ pas du json");
    expect(res.ok).toBe(false);
  });

  it("refuse un template inconnu", async () => {
    const res = await packFromStudio(root, "inconnu", JSON.stringify(MANIFEST));
    expect(res.ok).toBe(false);
  });
});
