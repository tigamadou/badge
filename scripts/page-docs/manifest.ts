import fs from "node:fs";
import path from "node:path";
import { DOCS_DIR, assignDocIds, discoverPages, type DocSpace } from "./paths";
import { AUDIENCES, parseDoc, type ParsedDoc } from "./format";

export const MANIFEST_FILE = `${DOCS_DIR}/manifest.generated.ts`;
export const INDEX_FILE = `${DOCS_DIR}/index.generated.ts`;
const HEADER = "// Généré par scripts/page-docs — ne pas modifier à la main (make docs-stamp).\n";

export interface ManifestEntry {
  id: string;
  route: string;
  space: DocSpace;
  title: string;
  audience: string;
  access?: string;
  updatedAt: string;
  body: string;
}

/** Identifiants des fichiers de doc existants (`org/events/new`), triés. */
export function listDocIds(root: string): string[] {
  const base = path.join(root, DOCS_DIR);
  const ids: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith(".md")) {
        ids.push(path.relative(base, abs).split(path.sep).join("/").slice(0, -3));
      }
    }
  };
  if (fs.existsSync(base)) walk(base);
  return ids.sort();
}

export function docPath(root: string, id: string): string {
  return path.join(root, DOCS_DIR, `${id}.md`);
}

export function readDoc(root: string, id: string): ParsedDoc & { raw: string } {
  const raw = fs.readFileSync(docPath(root, id), "utf8");
  return { ...parseDoc(raw), raw };
}

/** Entrée de manifeste d'une doc, ou null si son en-tête est inutilisable. */
export function entryOf(id: string, route: string, doc: ParsedDoc): ManifestEntry | null {
  const fm = doc.frontmatter;
  if (!fm.title || !fm.audience || !AUDIENCES.includes(fm.audience) || !fm.updatedAt) return null;
  return {
    id,
    route,
    space: id.split("/")[0] as DocSpace,
    title: fm.title,
    audience: fm.audience,
    ...(fm.access ? { access: fm.access } : {}),
    updatedAt: fm.updatedAt,
    body: doc.body,
  };
}

export function renderEntry(entry: ManifestEntry | Omit<ManifestEntry, "body">): string {
  return JSON.stringify(entry, null, 2)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function renderModule(typeName: string, constName: string, entries: (ManifestEntry | Omit<ManifestEntry, "body">)[]): string {
  const list = entries.length === 0 ? "[]" : `[\n${entries.map((e) => `${renderEntry(e)},`).join("\n")}\n]`;
  return `${HEADER}import type { ${typeName} } from "./types";\n\nexport const ${constName}: ${typeName}[] = ${list};\n`;
}

export function buildManifests(root: string): { manifest: string; index: string } {
  const pages = discoverPages(root);
  const idToRoute = new Map<string, string>();
  for (const [route, id] of assignDocIds(pages.map((p) => p.route))) idToRoute.set(id, route);
  const entries: ManifestEntry[] = [];
  for (const id of listDocIds(root)) {
    const route = idToRoute.get(id);
    if (!route) continue;
    const entry = entryOf(id, route, readDoc(root, id));
    if (entry) entries.push(entry);
  }
  const index = entries.map((e) => {
    const { body, ...rest } = e;
    void body;
    return rest;
  });
  return {
    manifest: renderModule("PageDocEntry", "PAGE_DOCS", entries),
    index: renderModule("PageDocIndexEntry", "PAGE_DOC_INDEX", index),
  };
}

export function readManifests(root: string): { manifest: string | null; index: string | null } {
  const read = (rel: string) => {
    const abs = path.join(root, rel);
    return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
  };
  return { manifest: read(MANIFEST_FILE), index: read(INDEX_FILE) };
}

export function writeManifests(root: string): void {
  const { manifest, index } = buildManifests(root);
  fs.mkdirSync(path.join(root, DOCS_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, MANIFEST_FILE), manifest);
  fs.writeFileSync(path.join(root, INDEX_FILE), index);
}
