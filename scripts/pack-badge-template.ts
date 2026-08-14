import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import JSZip from "jszip";
import { parseManifest } from "../src/lib/badge-templates/declarative/schema";

// Collecte les fichiers d'un sous-dossier du paquet (assets/ ou fonts/), s'il existe.
function collect(dir: string, sub: string): Array<{ path: string; body: Buffer }> {
  const full = join(dir, sub);
  if (!existsSync(full)) return [];
  return readdirSync(full, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => ({ path: `${sub}/${e.name}`, body: readFileSync(join(full, e.name)) }));
}

// Empaquette un dossier de travail en archive installable. Le manifeste est valide
// AVANT l'ecriture : mieux vaut echouer ici, ou le message est immediat, qu'au
// televersement.
export async function packTemplate(name: string, root: string): Promise<string> {
  const dir = resolve(root, name);
  if (!existsSync(dir)) {
    throw new Error(`dossier introuvable : ${dir}`);
  }
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`manifeste introuvable : ${manifestPath}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    throw new Error("manifeste invalide : JSON illisible.");
  }

  const files = [...collect(dir, "assets"), ...collect(dir, "fonts")];
  const parsed = parseManifest(
    raw,
    files.map((f) => f.path),
  );
  if (!parsed.ok) {
    throw new Error(`manifeste invalide :\n  - ${parsed.errors.join("\n  - ")}`);
  }

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(parsed.manifest, null, 2));
  for (const file of files) zip.file(file.path, file.body);

  const target = resolve(root, `${name}.zip`);
  writeFileSync(target, await zip.generateAsync({ type: "nodebuffer" }));
  return target;
}

/* v8 ignore start -- point d'entree CLI, exerce par `make pack-badge-template` */
async function main(): Promise<void> {
  const name = process.env.NAME;
  if (!name) {
    console.error("Usage : make pack-badge-template NAME=<slug>");
    process.exitCode = 1;
    return;
  }
  try {
    const target = await packTemplate(name, resolve("badge-templates"));
    console.log(`Archive prete : ${target}`);
    console.log("Installez-la depuis /platform/badge-templates.");
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("pack-badge-template.ts")) {
  void main();
}
/* v8 ignore stop */
