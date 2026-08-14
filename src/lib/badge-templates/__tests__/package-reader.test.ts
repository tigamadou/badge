import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { readTemplatePackage, MAX_ENTRIES } from "../package-reader";

// Octets d'en-tete reels : c'est sur eux que le type est verifie, jamais sur
// l'extension. PNG = 89 50 4E 47, JPEG = FF D8 FF, WebP = RIFF....WEBP, TTF = 00 01 00 00.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]);
const TTF = Buffer.from([0x00, 0x01, 0x00, 0x00, 0, 0, 0, 0]);
const OTF = Buffer.concat([Buffer.from("OTTO"), Buffer.alloc(8)]);

const MANIFEST = {
  formatVersion: 1,
  family: "salon-2027",
  label: "Badge Salon",
  description: "",
  page: { widthPx: 1011, heightPx: 638, count: 1 },
  blocks: [{ type: "rect", page: 1, x: 0, y: 0, w: 1011, h: 638, image: { asset: "assets/fond.png" } }],
};

async function zipOf(files: Record<string, Buffer | string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: "nodebuffer" });
}

// Archive REELLEMENT compressee : sans DEFLATE, JSZip stocke tel quel et une
// « bombe » de 40 Mo pese 40 Mo, heurtant la borne d'entree au lieu de celle du
// volume decompresse.
async function compressedZipOf(files: Record<string, Buffer | string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

function errorsOf(res: Awaited<ReturnType<typeof readTemplatePackage>>): string {
  return res.ok === false ? res.errors.join(" | ") : "";
}

describe("readTemplatePackage", () => {
  it("accepte une archive valide", async () => {
    const res = await readTemplatePackage(
      await zipOf({ "manifest.json": JSON.stringify(MANIFEST), "assets/fond.png": PNG }),
    );
    expect(res.ok, errorsOf(res)).toBe(true);
    expect(res.ok === true && res.assets.map((a) => a.path)).toEqual(["assets/fond.png"]);
  });

  it("refuse une archive sans manifeste", async () => {
    const manifestLess = await zipOf({ "assets/fond.png": PNG });
    const res = await readTemplatePackage(manifestLess);
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/manifest\.json/i);
  });

  it("refuse un contenu qui n'est pas une archive", async () => {
    const res = await readTemplatePackage(Buffer.from("ceci n'est pas un zip"));
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/illisible|corrompu/i);
  });

  it("refuse un manifeste qui n'est pas du JSON", async () => {
    const res = await readTemplatePackage(
      await zipOf({ "manifest.json": "{ pas du json", "assets/fond.png": PNG }),
    );
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/JSON invalide/i);
  });

  it("refuse un manifeste invalide au sens du schema", async () => {
    const res = await readTemplatePackage(
      await zipOf({
        "manifest.json": JSON.stringify({ ...MANIFEST, formatVersion: 9 }),
        "assets/fond.png": PNG,
      }),
    );
    expect(res.ok).toBe(false);
  });

  it("refuse une entree hors des trois emplacements autorises", async () => {
    const res = await readTemplatePackage(
      await zipOf({
        "manifest.json": JSON.stringify(MANIFEST),
        "assets/fond.png": PNG,
        "README.md": "coucou",
      }),
    );
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/emplacement/i);
  });

  it("refuse un chemin remontant hors du dossier", async () => {
    // JSZip normalise "assets/../evil.png" en "evil.png" : la remontee est neutralisee
    // en amont, et l'entree est alors refusee comme hors emplacement. La garde sur ".."
    // du lecteur reste une defense en profondeur, au cas ou l'entree ne serait pas
    // normalisee. Ce qui compte ici : rien n'est extrait hors des dossiers permis.
    const res = await readTemplatePackage(
      await zipOf({ "manifest.json": JSON.stringify(MANIFEST), "assets/../evil.png": PNG }),
    );
    expect(res.ok).toBe(false);
  });

  it("refuse un chemin absolu", async () => {
    const res = await readTemplatePackage(
      await zipOf({ "manifest.json": JSON.stringify(MANIFEST), "/etc/passwd": PNG }),
    );
    expect(res.ok).toBe(false);
  });

  it("refuse une archive comptant trop d'entrees", async () => {
    const files: Record<string, Buffer | string> = { "manifest.json": JSON.stringify(MANIFEST) };
    for (let i = 0; i <= MAX_ENTRIES; i++) files[`assets/f${i}.png`] = PNG;
    const res = await readTemplatePackage(await zipOf(files));
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/entrees/i);
  });

  it("refuse une bombe de decompression", async () => {
    // 40 Mo de zeros se compressent en quelques kilo-octets : l'archive franchit la
    // borne d'entree, mais pas celle du volume decompresse.
    const res = await readTemplatePackage(
      await compressedZipOf({
        "manifest.json": JSON.stringify(MANIFEST),
        "assets/fond.png": Buffer.concat([PNG, Buffer.alloc(40 * 1024 * 1024, 0)]),
      }),
    );
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/volume decompresse/i);
  });

  it("refuse une archive trop lourde", async () => {
    const res = await readTemplatePackage(Buffer.alloc(11 * 1024 * 1024, 1));
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/taille/i);
  });

  it("refuse une image WebP", async () => {
    const manifest = { ...MANIFEST, blocks: [{ ...MANIFEST.blocks[0], asset: "assets/fond.webp" }] };
    const res = await readTemplatePackage(
      await zipOf({ "manifest.json": JSON.stringify(manifest), "assets/fond.webp": WEBP }),
    );
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/format non supporte/i);
  });

  it("refuse une image dont l'extension ment sur le contenu", async () => {
    const res = await readTemplatePackage(
      await zipOf({ "manifest.json": JSON.stringify(MANIFEST), "assets/fond.png": WEBP }),
    );
    expect(res.ok).toBe(false);
  });

  it("refuse une image trop lourde", async () => {
    const gros = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024, 7)]);
    const res = await readTemplatePackage(
      await zipOf({ "manifest.json": JSON.stringify(MANIFEST), "assets/fond.png": gros }),
    );
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/depasse/i);
  });

  it("accepte une image JPEG", async () => {
    const manifest = {
      ...MANIFEST,
      blocks: [{ ...MANIFEST.blocks[0], image: { asset: "assets/fond.jpg" } }],
    };
    const res = await readTemplatePackage(
      await zipOf({ "manifest.json": JSON.stringify(manifest), "assets/fond.jpg": JPEG }),
    );
    expect(res.ok, errorsOf(res)).toBe(true);
  });

  it("accepte une police TTF declaree", async () => {
    const manifest = {
      ...MANIFEST,
      fonts: [{ alias: "titre", file: "fonts/A.ttf" }],
      blocks: [
        MANIFEST.blocks[0],
        {
          type: "text", page: 1, x: 0, y: 0, w: 40, h: 6, text: "{event.title}",
          style: { font: "titre", sizePx: 42, color: "#000000", overflow: "clip" },
        },
      ],
    };
    const res = await readTemplatePackage(
      await zipOf({
        "manifest.json": JSON.stringify(manifest),
        "assets/fond.png": PNG,
        "fonts/A.ttf": TTF,
      }),
    );
    expect(res.ok, errorsOf(res)).toBe(true);
  });

  it("accepte une police OTF", async () => {
    const manifest = { ...MANIFEST, fonts: [{ alias: "t", file: "fonts/B.otf" }] };
    const res = await readTemplatePackage(
      await zipOf({
        "manifest.json": JSON.stringify(manifest),
        "assets/fond.png": PNG,
        "fonts/B.otf": OTF,
      }),
    );
    expect(res.ok, errorsOf(res)).toBe(true);
  });

  it("refuse une police d'un format non supporte", async () => {
    const manifest = { ...MANIFEST, fonts: [{ alias: "t", file: "fonts/C.ttf" }] };
    const res = await readTemplatePackage(
      await zipOf({
        "manifest.json": JSON.stringify(manifest),
        "assets/fond.png": PNG,
        "fonts/C.ttf": PNG,
      }),
    );
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/police .* format non reconnu/i);
  });

  it("refuse une police trop lourde", async () => {
    const grosse = Buffer.concat([TTF, Buffer.alloc(3 * 1024 * 1024, 0)]);
    const manifest = { ...MANIFEST, fonts: [{ alias: "t", file: "fonts/D.ttf" }] };
    const res = await readTemplatePackage(
      await zipOf({
        "manifest.json": JSON.stringify(manifest),
        "assets/fond.png": PNG,
        "fonts/D.ttf": grosse,
      }),
    );
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/depasse/i);
  });

  it("refuse une ressource declaree mais absente de l'archive", async () => {
    const res = await readTemplatePackage(
      await zipOf({ "manifest.json": JSON.stringify(MANIFEST) }),
    );
    expect(res.ok).toBe(false);
    expect(errorsOf(res)).toMatch(/absente du paquet/i);
  });
});
