import { PAGE_DOCS } from "@/content/page-docs/manifest.generated";
import type { PageDocEntry, PageDocSpace } from "@/content/page-docs/types";
import type { Permission } from "@/lib/permissions/catalog";
import { blockDecider, permissionsForRoute, type DocParams } from "./access";
import { filterPermissionBlocks } from "./blocks";
import { matchDocRoute } from "./match";
import { renderDocHtml } from "./render";
import { docTargetScope } from "./routes";

export { matchDocRoute } from "./match";
export { docTargetScope } from "./routes";
export { filterPermissionBlocks } from "./blocks";
export { renderDocHtml } from "./render";
export { resolveDocTarget } from "./access";
export type { DocParams } from "./access";

export interface LoadedDoc {
  id: string;
  title: string;
  updatedAt: string;
  audience: string;
  html: string;
  /** Lien vers la section Documentation de l'espace. */
  docsHref: string;
}

export interface DocListItem {
  id: string;
  /** Identifiant sans le préfixe d'espace : segment d'URL de `…/docs/<slug>`. */
  slug: string;
  /** Premier segment du slug (ou « Accueil » pour la racine de l'espace). */
  section: string;
  title: string;
  summary: string;
  updatedAt: string;
}

const entryById = (id: string): PageDocEntry | undefined => PAGE_DOCS.find((d) => d.id === id);

export function docsHrefFor(space: PageDocSpace, params: DocParams): string {
  if (space === "org") return `/org/${params.orgId}/docs`;
  if (space === "event") return `/event/${params.eventId}/docs`;
  return `/${space}/docs`;
}

/** Première phrase du corps (hors titres et marqueurs de bloc), sans mise en forme Markdown. */
export function summaryOf(body: string): string {
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#") || line.startsWith(":::") || line.startsWith("|")) continue;
    const plain = line.replace(/^[-*]\s+/, "").replace(/[*_`]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    const sentence = /^.*?[.!?](?:\s|$)/.exec(plain)?.[0] ?? plain;
    return sentence.trim();
  }
  return "";
}

async function loadEntryForUser(
  userId: string,
  entry: PageDocEntry,
  params: DocParams,
): Promise<LoadedDoc | null> {
  const perms = await permissionsForRoute(userId, entry.route, params);
  if (perms.size === 0) return null;
  if (entry.access && !perms.has(entry.access as Permission)) return null;
  const body = filterPermissionBlocks(entry.body, blockDecider(perms, docTargetScope(entry.route)));
  return {
    id: entry.id,
    title: entry.title,
    updatedAt: entry.updatedAt,
    audience: entry.audience,
    html: renderDocHtml(body),
    docsHref: docsHrefFor(entry.space, params),
  };
}

/** Doc de la page `pathname` pour l'utilisateur ; null = pas de doc, compte invalide ou accès refusé. */
export async function loadDocForUser(userId: string, pathname: string): Promise<LoadedDoc | null> {
  const match = matchDocRoute(pathname);
  const entry = match ? entryById(match.id) : undefined;
  if (!match || !entry) return null;
  return loadEntryForUser(userId, entry, match.params);
}

/** Doc d'identifiant `id` (lecture pleine page de la section Documentation) ; null si absente ou refusée. */
export async function loadDocById(userId: string, id: string, params: DocParams): Promise<LoadedDoc | null> {
  const entry = entryById(id);
  if (!entry) return null;
  return loadEntryForUser(userId, entry, params);
}

/** Docs de l'espace que l'utilisateur peut ouvrir (`access` détenu, ou aucun `access`), dans l'ordre des identifiants. */
export async function listDocsForUser(userId: string, space: PageDocSpace, params: DocParams): Promise<DocListItem[]> {
  // La portée des permissions ne dépend que du premier segment de la route : `/<espace>` suffit.
  const perms = await permissionsForRoute(userId, `/${space}`, params);
  if (perms.size === 0) return [];
  return PAGE_DOCS.filter((d) => d.space === space)
    .filter((d) => !d.access || perms.has(d.access as Permission))
    .map((d) => {
      const slug = d.id.slice(space.length + 1);
      return {
        id: d.id,
        slug,
        section: slug === "index" ? "Accueil" : slug.split("/")[0],
        title: d.title,
        summary: summaryOf(d.body),
        updatedAt: d.updatedAt,
      };
    });
}
