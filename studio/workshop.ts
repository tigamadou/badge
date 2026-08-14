import { readdir, readFile, writeFile, stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { checkAsset, sniff, type PackageAsset } from "../src/lib/badge-templates/package-reader";

// Meme motif que scripts/new-badge-template.ts : un nom valide ne peut contenir
// ni separateur, ni point, ce qui exclut par construction toute remontee de chemin.
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ASSET_DIRS = ["assets", "fonts"] as const;

export type AssetDir = (typeof ASSET_DIRS)[number];

// Un nom de fichier de ressource : ni separateur, ni remontee de chemin.
const FILENAME = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

export function isValidTemplateName(name: string): boolean {
  return SLUG.test(name);
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export async function listTemplates(
  root: string,
): Promise<Array<{ name: string; hasManifest: boolean }>> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: Array<{ name: string; hasManifest: boolean }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    out.push({
      name: entry.name,
      hasManifest: await fileExists(join(root, entry.name, "manifest.json")),
    });
  }
  return out;
}

async function collectAssets(dir: string): Promise<PackageAsset[]> {
  const out: PackageAsset[] = [];
  for (const sub of ASSET_DIRS) {
    let entries;
    try {
      entries = await readdir(join(dir, sub), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const body = await readFile(join(dir, sub, entry.name));
      const contentType = sniff(body);
      // Une ressource au type indetectable serait refusee a l'installation :
      // l'ignorer ici fait echouer la validation au meme endroit qu'en vrai.
      if (!contentType) continue;
      out.push({ path: `${sub}/${entry.name}`, body, contentType });
    }
  }
  return out;
}

export async function readTemplate(
  root: string,
  name: string,
): Promise<{ manifest: string; assets: PackageAsset[] } | null> {
  if (!isValidTemplateName(name)) return null;
  const dir = join(root, name);
  if (!(await isDirectory(dir))) return null;
  let manifest = "";
  try {
    manifest = await readFile(join(dir, "manifest.json"), "utf8");
  } catch {
    manifest = "";
  }
  return { manifest, assets: await collectAssets(dir) };
}

export async function writeManifest(
  root: string,
  name: string,
  manifest: string,
): Promise<boolean> {
  if (!isValidTemplateName(name)) return false;
  const dir = join(root, name);
  if (!(await isDirectory(dir))) return false;
  await writeFile(join(dir, "manifest.json"), manifest, "utf8");
  return true;
}

export type SaveAssetResult = { ok: true; path: string } | { ok: false; error: string };

// Depose une ressource dans l'atelier. Les controles sont ceux de l'installation
// (checkAsset : format sniffe sur les octets, taille bornee), pour qu'un paquet
// compose dans le studio ne puisse pas etre refuse plus tard au televersement.
export async function saveAsset(
  root: string,
  name: string,
  dir: AssetDir,
  filename: string,
  body: Buffer,
): Promise<SaveAssetResult> {
  if (!isValidTemplateName(name)) return { ok: false, error: "Nom de template invalide." };
  if (!FILENAME.test(filename) || filename.includes("..")) {
    return { ok: false, error: `Nom de fichier invalide : "${filename}".` };
  }
  const templateDir = join(root, name);
  if (!(await isDirectory(templateDir))) {
    return { ok: false, error: `Template introuvable : "${name}".` };
  }

  const path = `${dir}/${filename}`;
  const checked = checkAsset(path, body);
  if ("error" in checked) return { ok: false, error: checked.error };

  await mkdir(join(templateDir, dir), { recursive: true });
  await writeFile(join(templateDir, dir, filename), body);
  return { ok: true, path };
}
