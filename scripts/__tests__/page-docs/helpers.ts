import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Dépôt factice dans un dossier temporaire : `files` associe un chemin relatif à son contenu. */
export function makeRepo(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "page-docs-"));
  for (const [rel, content] of Object.entries(files)) writeFile(root, rel, content);
  return root;
}

export function writeFile(root: string, rel: string, content: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

export function removeRepo(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}
