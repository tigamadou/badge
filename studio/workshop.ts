import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { sniff, type PackageAsset } from "../src/lib/badge-templates/package-reader";

// Meme motif que scripts/new-badge-template.ts : un nom valide ne peut contenir
// ni separateur, ni point, ce qui exclut par construction toute remontee de chemin.
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ASSET_DIRS = ["assets", "fonts"] as const;

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
