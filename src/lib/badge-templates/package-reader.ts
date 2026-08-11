import JSZip from "jszip";
import { parseManifest } from "./declarative/schema";
import type { TemplateManifest } from "./declarative/manifest-types";

export const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
export const MAX_UNCOMPRESSED_BYTES = 30 * 1024 * 1024;
export const MAX_ENTRIES = 50;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_FONT_BYTES = 2 * 1024 * 1024;

const MANIFEST_PATH = "manifest.json";

export type PackageAsset = { path: string; body: Buffer; contentType: string };

export type ReadResult =
  | { ok: true; manifest: TemplateManifest; assets: PackageAsset[] }
  | { ok: false; errors: string[] };

// Le type est deduit des octets d'en-tete, jamais de l'extension : une image WebP
// renommee en .png doit etre refusee, car @react-pdf ne sait pas la lire.
function sniff(body: Buffer): "image/png" | "image/jpeg" | "font/ttf" | null {
  if (
    body.length >= 8 &&
    body[0] === 0x89 &&
    body[1] === 0x50 &&
    body[2] === 0x4e &&
    body[3] === 0x47
  ) {
    return "image/png";
  }
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return "image/jpeg";
  }
  // TTF : 00 01 00 00 ou "true" ; OTF : "OTTO".
  const head = body.subarray(0, 4).toString("latin1");
  const isTtf = body[0] === 0x00 && body[1] === 0x01 && body[2] === 0x00 && body[3] === 0x00;
  if (head === "OTTO" || head === "true" || isTtf) return "font/ttf";
  return null;
}

function pathIssue(path: string): string | null {
  if (path.startsWith("/") || path.includes("..") || path.includes("\\")) {
    return `entree "${path}" : chemin non autorise.`;
  }
  if (path !== MANIFEST_PATH && !path.startsWith("assets/") && !path.startsWith("fonts/")) {
    return `entree "${path}" : emplacement non autorise (attendu manifest.json, assets/ ou fonts/).`;
  }
  return null;
}

function checkAsset(path: string, body: Buffer): { error: string } | { contentType: string } {
  const kind = sniff(body);
  const isFont = path.startsWith("fonts/");

  if (isFont) {
    if (kind !== "font/ttf") {
      return { error: `police "${path}" : format non reconnu (TTF ou OTF attendu).` };
    }
    if (body.length > MAX_FONT_BYTES) {
      return { error: `police "${path}" : depasse ${MAX_FONT_BYTES} octets.` };
    }
    return { contentType: "font/ttf" };
  }

  if (kind !== "image/png" && kind !== "image/jpeg") {
    return {
      error: `image "${path}" : format non supporte. Seuls JPEG et PNG sont lisibles par le moteur PDF.`,
    };
  }
  if (body.length > MAX_IMAGE_BYTES) {
    return { error: `image "${path}" : depasse ${MAX_IMAGE_BYTES} octets.` };
  }
  return { contentType: kind };
}

// Seul module autorise a ouvrir une archive. Toutes les bornes sont appliquees AVANT
// extraction : une archive refusee ne laisse rien derriere elle.
export async function readTemplatePackage(archive: Buffer): Promise<ReadResult> {
  if (archive.length > MAX_ARCHIVE_BYTES) {
    return { ok: false, errors: [`archive : taille superieure a ${MAX_ARCHIVE_BYTES} octets.`] };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(archive);
  } catch {
    return { ok: false, errors: ["archive : fichier illisible ou corrompu."] };
  }

  const entries = Object.values(zip.files).filter((f) => !f.dir);
  if (entries.length > MAX_ENTRIES) {
    return { ok: false, errors: [`archive : plus de ${MAX_ENTRIES} entrees.`] };
  }

  const errors: string[] = [];
  for (const entry of entries) {
    const issue = pathIssue(entry.name);
    if (issue) errors.push(issue);
  }
  if (errors.length > 0) return { ok: false, errors };

  const manifestEntry = entries.find((e) => e.name === MANIFEST_PATH);
  if (!manifestEntry) {
    return { ok: false, errors: ["archive : manifest.json absent de la racine."] };
  }

  const assets: PackageAsset[] = [];
  let uncompressed = 0;

  for (const entry of entries) {
    const body = await entry.async("nodebuffer");
    uncompressed += body.length;
    // Borne sur le volume decompresse : une archive minuscule peut gonfler a plusieurs
    // gigaoctets (bombe de decompression).
    if (uncompressed > MAX_UNCOMPRESSED_BYTES) {
      return {
        ok: false,
        errors: [`archive : volume decompresse superieur a ${MAX_UNCOMPRESSED_BYTES} octets.`],
      };
    }
    if (entry.name === MANIFEST_PATH) continue;

    const checked = checkAsset(entry.name, body);
    if ("error" in checked) {
      errors.push(checked.error);
      continue;
    }
    assets.push({ path: entry.name, body, contentType: checked.contentType });
  }
  if (errors.length > 0) return { ok: false, errors };

  const rawManifest = await manifestEntry.async("string");
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawManifest);
  } catch {
    return { ok: false, errors: ["manifest.json : JSON invalide."] };
  }

  const result = parseManifest(
    parsedJson,
    assets.map((a) => a.path),
  );
  if (!result.ok) return { ok: false, errors: result.errors };

  return { ok: true, manifest: result.manifest, assets };
}
