// Lecture d'une tranche de liste : compte, borne la page demandee, lit la tranche.

export interface PageResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function clampPage(page: number, total: number, pageSize: number): { page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number.isFinite(page) ? Math.floor(page) : 1;
  return { page: Math.min(Math.max(1, requested), totalPages), totalPages };
}

export async function paginate<T>(
  p: { page: number; pageSize: number },
  count: () => Promise<number>,
  find: (range: { skip: number; take: number }) => Promise<T[]>,
): Promise<PageResult<T>> {
  const total = await count();
  const { page, totalPages } = clampPage(p.page, total, p.pageSize);
  if (total === 0) return { rows: [], total, page, pageSize: p.pageSize, totalPages };
  const rows = await find({ skip: (page - 1) * p.pageSize, take: p.pageSize });
  return { rows, total, page, pageSize: p.pageSize, totalPages };
}

export function paginateArray<T>(items: T[], p: { page: number; pageSize: number }): PageResult<T> {
  const total = items.length;
  const { page, totalPages } = clampPage(p.page, total, p.pageSize);
  const start = (page - 1) * p.pageSize;
  return { rows: items.slice(start, start + p.pageSize), total, page, pageSize: p.pageSize, totalPages };
}
