// v2-12 : copie les preview.png des templates de badges depuis
// src/lib/badge-templates/<id>/preview.png vers public/badge-previews/<id>.png.
// Execute en prebuild (cf. package.json) ; necessaire pour que Next serve
// les previews dans les pages de selection.
import { readdirSync, mkdirSync, copyFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC_DIR = resolve(process.cwd(), "src/lib/badge-templates");
const DEST_DIR = resolve(process.cwd(), "public/badge-previews");

function isTemplateDir(name: string): boolean {
  if (name === "__tests__") return false;
  const stat = statSync(join(SRC_DIR, name));
  return stat.isDirectory();
}

function main(): void {
  if (!existsSync(SRC_DIR)) {
    console.error(`[copy-badge-previews] source absente : ${SRC_DIR}`);
    process.exit(1);
  }
  mkdirSync(DEST_DIR, { recursive: true });

  const entries = readdirSync(SRC_DIR).filter(isTemplateDir);
  let copied = 0;
  for (const id of entries) {
    const src = join(SRC_DIR, id, "preview.png");
    if (!existsSync(src)) {
      console.warn(`[copy-badge-previews] manquant : ${src}`);
      continue;
    }
    const dest = join(DEST_DIR, `${id}.png`);
    copyFileSync(src, dest);
    copied += 1;
  }
  console.log(`${copied} preview(s) copiees.`);
}

main();
