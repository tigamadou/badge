import fs from "node:fs";
import path from "node:path";

const MAX_DEPTH = 3;
const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;

const toPosix = (p: string) => p.split(path.sep).join("/");
const inScope = (rel: string) => rel.startsWith("src/app/") || rel.startsWith("src/components/");

function resolveFile(root: string, base: string): string | null {
  const candidates = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  for (const c of candidates) {
    const abs = path.join(root, c);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return c;
  }
  return null;
}

function importsOf(root: string, file: string): string[] {
  let text: string;
  try {
    text = fs.readFileSync(path.join(root, file), "utf8");
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1];
    let base: string | null = null;
    if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
    else if (spec.startsWith("./") || spec.startsWith("../")) base = toPosix(path.posix.join(path.posix.dirname(file), spec));
    if (!base) continue;
    const resolved = resolveFile(root, base);
    if (resolved && inScope(resolved)) found.push(resolved);
  }
  return found;
}

/** Page et fichiers qu'elle importe sous src/app et src/components, jusqu'à 3 niveaux, triés. */
export function collectSources(root: string, pageFile: string): string[] {
  const seen = new Set<string>([pageFile]);
  let frontier = [pageFile];
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const next: string[] = [];
    for (const file of frontier) {
      for (const dep of importsOf(root, file)) {
        if (!seen.has(dep)) {
          seen.add(dep);
          next.push(dep);
        }
      }
    }
    frontier = next;
  }
  return [...seen].sort();
}
