import { PERMISSION_KEYS, permissionScopeOf, type Permission } from "../../src/lib/permissions/catalog";
import { docTargetScope } from "../../src/lib/page-docs/routes";
import { AUDIENCES, blockKeys, validateBlocks } from "./format";
import { buildManifests, listDocIds, readDoc, readManifests } from "./manifest";
import { assignDocIds, discoverPages, docFileForId } from "./paths";
import { hashSources } from "./hash";
import { collectSources } from "./sources";

export interface DocProblem {
  kind: "obsolete" | "missing" | "orphan" | "format" | "manifest";
  target: string;
  message: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function checkKey(key: string, scope: string, what: string): string | null {
  if (!PERMISSION_KEYS.has(key)) return `${what} : clé de permission inconnue « ${key} »`;
  const keyScope = permissionScopeOf(key as Permission);
  if (keyScope !== scope) return `${what} : la clé « ${key} » est de portée ${keyScope}, la page est de portée ${scope}`;
  return null;
}

export function checkDocs(root: string): DocProblem[] {
  const problems: DocProblem[] = [];
  const add = (kind: DocProblem["kind"], target: string, message: string) => problems.push({ kind, target, message });

  const pages = discoverPages(root);
  const ids = assignDocIds(pages.map((p) => p.route));
  const byId = new Map<string, (typeof pages)[number]>();
  for (const page of pages) {
    const id = ids.get(page.route)!;
    const other = byId.get(id);
    if (other) add("format", id, `collision d'identifiant entre ${other.route} et ${page.route}`);
    else byId.set(id, page);
  }

  const docIds = new Set(listDocIds(root));
  for (const [id, page] of byId) {
    if (!docIds.has(id)) add("missing", id, `page sans doc (${page.route}) : créer ${docFileForId(id)}`);
  }

  for (const id of docIds) {
    const page = byId.get(id);
    if (!page) {
      add("orphan", id, "aucune page ne correspond (page supprimée ou route renommée) : supprimer la doc");
      continue;
    }
    const doc = readDoc(root, id);
    const fm = doc.frontmatter;
    const fmProblems: string[] = [];
    for (const field of ["route", "title", "audience", "sourceHash", "updatedAt"] as const) {
      if (!fm[field]) fmProblems.push(`champ « ${field} » manquant`);
    }
    if (!Array.isArray(fm.sources)) fmProblems.push("champ « sources » manquant");
    if (fm.audience && !AUDIENCES.includes(fm.audience)) fmProblems.push(`audience invalide « ${fm.audience} »`);
    if (fm.updatedAt && !DATE_RE.test(fm.updatedAt)) fmProblems.push(`updatedAt invalide « ${fm.updatedAt} » (AAAA-MM-JJ attendu)`);
    if (fm.route && fm.route !== page.route) fmProblems.push(`route « ${fm.route} » différente de celle du fichier (${page.route})`);
    const scope = docTargetScope(page.route);
    if (fm.access) {
      const issue = checkKey(fm.access, scope, "access");
      if (issue) fmProblems.push(issue);
    }
    for (const message of fmProblems) add("format", id, message);

    for (const issue of validateBlocks(doc.body, PERMISSION_KEYS)) {
      add("format", id, `ligne ${doc.bodyStartLine + issue.line - 1} : ${issue.message}`);
    }
    for (const { key, line } of blockKeys(doc.body)) {
      if (!PERMISSION_KEYS.has(key)) continue;
      const issue = checkKey(key, scope, `ligne ${doc.bodyStartLine + line - 1}`);
      if (issue) add("format", id, issue);
    }

    if (fm.sourceHash && Array.isArray(fm.sources)) {
      const sources = collectSources(root, page.file);
      const same = sources.length === fm.sources.length && sources.every((s, i) => s === fm.sources![i]);
      if (!same || hashSources(root, sources) !== fm.sourceHash) {
        add("obsolete", id, `sources modifiées depuis le dernier tampon : mettre à jour le texte puis \`make docs-stamp PAGES="${id}"\``);
      }
    }
  }

  const built = buildManifests(root);
  const stored = readManifests(root);
  if (stored.manifest !== built.manifest) add("manifest", "manifest.generated.ts", "absent ou différent : lancer `make docs-stamp PAGES=all`");
  if (stored.index !== built.index) add("manifest", "index.generated.ts", "absent ou différent : lancer `make docs-stamp PAGES=all`");

  const order = ["missing", "obsolete", "orphan", "format", "manifest"];
  return problems.sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || (a.target < b.target ? -1 : a.target > b.target ? 1 : 0),
  );
}
