import { expect, type Page } from "@playwright/test";

const SIZE_LABEL = "Nombre de résultats par page";

// Choisit une taille de page puis attend l'URL mise a jour (sans page > 1).
export async function selectPageSize(page: Page, size: number): Promise<void> {
  await page.getByLabel(SIZE_LABEL).selectOption(String(size));
  await expect(page).toHaveURL(new RegExp(`pageSize=${size}(&|$)`));
  await expect(page).not.toHaveURL(/page=([2-9]|\d{2,})(&|$)/);
}

export async function expectPagination(
  page: Page,
  opts: { total: number; pageSize: number; page?: number },
): Promise<void> {
  await expect(page.getByText(`${opts.total} résultat${opts.total > 1 ? "s" : ""}`, { exact: true })).toBeVisible();
  await expect(page.getByLabel(SIZE_LABEL)).toHaveValue(String(opts.pageSize));
  await expect(page.locator('button[aria-current="page"]')).toHaveText(String(opts.page ?? 1));
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

// Cree n elements en sequence (indice 0..n-1) ; retourne les resultats dans l'ordre.
export async function seedMany<T>(n: number, make: (i: number) => Promise<T>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(await make(i));
  return out;
}
