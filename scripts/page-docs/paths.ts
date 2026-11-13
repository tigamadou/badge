import fs from "node:fs";
import path from "node:path";

export type DocSpace = "platform" | "org" | "event" | "account";
export interface PageEntry {
  route: string;
  space: DocSpace;
  /** Chemin du page.tsx relatif au dépôt, séparateurs `/`. */
  file: string;
}

export const DOC_SPACES: readonly DocSpace[] = ["platform", "org", "event", "account"];
export const DOCS_DIR = "src/content/page-docs";

const isDynamic = (segment: string) => /^\[.+\]$/.test(segment);
const isGroup = (segment: string) => /^\(.+\)$/.test(segment);

/** Segments d'une route après l'espace et, pour org/event, après l'identifiant de l'espace. */
function innerSegments(segments: string[]): string[] {
  const space = segments[0];
  return space === "org" || space === "event" ? segments.slice(2) : segments.slice(1);
}

function walk(dir: string, visit: (abs: string) => void): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, visit);
    else if (entry.name === "page.tsx") visit(abs);
  }
}

/** Pages des quatre espaces connectés (hors pages `docs` de documentation), triées par route. */
export function discoverPages(root: string): PageEntry[] {
  const pages: PageEntry[] = [];
  for (const space of DOC_SPACES) {
    const dir = path.join(root, "src", "app", space);
    if (!fs.existsSync(dir)) continue;
    walk(dir, (abs) => {
      const file = path.relative(root, abs).split(path.sep).join("/");
      const rel = path.relative(path.join(root, "src", "app"), path.dirname(abs)).split(path.sep);
      const segments = rel.filter((s) => !isGroup(s));
      if (innerSegments(segments)[0] === "docs") return;
      pages.push({ route: "/" + segments.join("/"), space, file });
    });
  }
  return pages.sort((a, b) => (a.route < b.route ? -1 : a.route > b.route ? 1 : 0));
}

/**
 * Identifiant de doc d'une route : segments dynamiques omis, `index` pour la racine d'un espace,
 * `detail` quand le dernier segment est dynamique (hors identifiant d'espace).
 */
export function docIdForRoute(route: string): string {
  const segments = route.split("/").filter(Boolean);
  const space = segments[0];
  const rest = space === "org" || space === "event" ? segments.slice(2) : segments.slice(1);
  const named = rest.filter((s) => !isDynamic(s));
  if (rest.length === 0) return `${space}/index`;
  if (isDynamic(rest[rest.length - 1])) return [space, ...named, "detail"].join("/");
  return [space, ...named].join("/");
}

export function docFileForId(id: string): string {
  return `${DOCS_DIR}/${id}.md`;
}

export function docFileForRoute(route: string): string {
  return docFileForId(docIdForRoute(route));
}

/** Identifiant développé : les segments dynamiques intermédiaires gardent leur nom (`[requestId]` -> `requestId`). */
function expandedDocId(route: string): string {
  const segments = route.split("/").filter(Boolean);
  const space = segments[0];
  const rest = space === "org" || space === "event" ? segments.slice(2) : segments.slice(1);
  if (rest.length === 0) return `${space}/index`;
  const tailDynamic = isDynamic(rest[rest.length - 1]);
  const kept = (tailDynamic ? rest.slice(0, -1) : rest).map((s) => (isDynamic(s) ? s.slice(1, -1) : s));
  return [space, ...kept, ...(tailDynamic ? ["detail"] : [])].join("/");
}

const dynamicCount = (route: string) => route.split("/").filter(isDynamic).length;

/**
 * Identifiants de doc de toutes les routes. En cas de collision après omission des segments
 * dynamiques, la route qui en compte le moins garde l'identifiant de base ; les autres prennent
 * l'identifiant développé. Une collision encore présente est signalée par `docs-check`.
 */
export function assignDocIds(routes: string[]): Map<string, string> {
  const groups = new Map<string, string[]>();
  for (const route of routes) {
    const id = docIdForRoute(route);
    groups.set(id, [...(groups.get(id) ?? []), route]);
  }
  const result = new Map<string, string>();
  for (const [id, group] of groups) {
    const sorted = [...group].sort((a, b) => dynamicCount(a) - dynamicCount(b) || (a < b ? -1 : 1));
    sorted.forEach((route, i) => result.set(route, i === 0 ? id : expandedDocId(route)));
  }
  return result;
}
