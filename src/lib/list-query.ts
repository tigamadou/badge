// Lecture partagee des parametres de pagination d'une liste (page, pageSize) depuis l'URL.
// Fonctions pures : valeurs hostiles ramenees aux defauts ou plafonnees, jamais de skip negatif.

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 500];
export const DEFAULT_PAGE_SIZE = 20;
// Borne haute de `page` : evite tout debordement de skip (Prisma/MySQL) sur une valeur absurde.
export const LIST_PAGE_MAX = 100_000;

type ListParams = URLSearchParams | Record<string, string | string[] | undefined>;

function rawValue(params: ListParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function positiveInt(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function parseListPage(
  params: ListParams,
  opts: { defaultSize?: number } = {},
): { page: number; pageSize: number; skip: number; take: number } {
  const page = Math.min(positiveInt(rawValue(params, "page")) ?? 1, LIST_PAGE_MAX);
  const size = positiveInt(rawValue(params, "pageSize"));
  const pageSize = size !== null && PAGE_SIZE_OPTIONS.includes(size) ? size : (opts.defaultSize ?? DEFAULT_PAGE_SIZE);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

// Reecrit page / pageSize dans une query string en conservant les autres parametres.
export function withListParams(search: string, patch: { page?: number; pageSize?: number }): string {
  const params = new URLSearchParams(search);
  if (patch.page !== undefined) params.set("page", String(patch.page));
  if (patch.pageSize !== undefined) params.set("pageSize", String(patch.pageSize));
  return params.toString();
}
