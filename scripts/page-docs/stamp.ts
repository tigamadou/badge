import fs from "node:fs";
import { hashSources } from "./hash";
import { serializeDoc, type DocFrontmatter } from "./format";
import { entryOf, docPath, listDocIds, readDoc, readManifests, renderEntry, writeManifests } from "./manifest";
import { DOC_SPACES, assignDocIds, discoverPages, type DocSpace } from "./paths";
import { collectSources } from "./sources";

/** Sélecteurs acceptés : identifiant (`org/events/new`), route, espace (`org`) ou `all`. */
export function resolveSelectors(root: string, selectors: string[]): string[] {
  const pages = discoverPages(root);
  const idByRoute = assignDocIds(pages.map((p) => p.route));
  const docIds = listDocIds(root);
  const result = new Set<string>();
  for (const selector of selectors) {
    if (selector === "all") docIds.forEach((id) => result.add(id));
    else if (DOC_SPACES.includes(selector as DocSpace)) docIds.filter((id) => id.startsWith(`${selector}/`)).forEach((id) => result.add(id));
    else if (selector.startsWith("/")) {
      const id = idByRoute.get(selector);
      if (!id) throw new Error(`Sélecteur inconnu : aucune page pour la route « ${selector} ».`);
      result.add(id);
    } else if (docIds.includes(selector)) result.add(selector);
    else throw new Error(`Sélecteur inconnu « ${selector} » : aucune doc de ce nom (créez d'abord le fichier .md avec route, title et audience).`);
  }
  return [...result].sort();
}

/**
 * Recalcule `sources`, `sourceHash` et `updatedAt` des docs indiquées, puis réécrit les manifestes.
 * `updatedAt` n'est modifié que si les sources ou le contenu publié de la doc ont changé.
 */
export function stampDocs(root: string, ids: string[], today: string): string[] {
  const pages = discoverPages(root);
  const idByRoute = assignDocIds(pages.map((p) => p.route));
  const pageById = new Map(pages.map((p) => [idByRoute.get(p.route)!, p]));
  const stored = readManifests(root).manifest ?? "";
  const stamped: string[] = [];
  for (const id of [...ids].sort()) {
    const page = pageById.get(id);
    if (!page) throw new Error(`Aucune page ne correspond à la doc « ${id} ».`);
    const doc = readDoc(root, id);
    const fm = doc.frontmatter;
    const sources = collectSources(root, page.file);
    const sourceHash = hashSources(root, sources);
    const published = entryOf(id, page.route, doc);
    const unchanged =
      published !== null &&
      stored.includes(renderEntry(published)) &&
      fm.sourceHash === sourceHash &&
      JSON.stringify(fm.sources) === JSON.stringify(sources) &&
      fm.route === page.route;
    const next: DocFrontmatter = {
      route: page.route,
      title: fm.title ?? "",
      audience: fm.audience ?? "organisateur",
      ...(fm.access ? { access: fm.access } : {}),
      sources,
      sourceHash,
      updatedAt: unchanged && fm.updatedAt ? fm.updatedAt : today,
    };
    fs.writeFileSync(docPath(root, id), serializeDoc(next, doc.body));
    stamped.push(id);
  }
  writeManifests(root);
  return stamped;
}
