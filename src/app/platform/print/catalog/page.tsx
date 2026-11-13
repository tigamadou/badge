import { requirePlatformPage } from "@/app/platform/page-guard";
import { listProducts } from "@/lib/print-catalog/products";
import { CatalogList } from "@/components/staff/print/CatalogList";
import { parseListPage } from "@/lib/list-query";
import { paginateArray } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

export default async function PrintCatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { permissions } = await requirePlatformPage("print.catalog.read", "/platform/print/catalog");
  const canWrite = permissions.has("print.catalog.manage");

  const kind = sp.kind === "BADGE" || sp.kind === "ACCESSORY" ? sp.kind : null;
  const archived = sp.archived === "true";
  const all = await listProducts({ kind: kind ?? undefined, archived });
  // listProducts renvoie tout le catalogue (lib hors lot) : la tranche est prise ici.
  const result = paginateArray(all, parseListPage(sp));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy">Catalogue</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Supports de badge et accessoires proposés aux organisateurs
        </p>
      </div>
      <CatalogList rows={result.rows} kind={kind} archived={archived} canWrite={canWrite} />
      <UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />
    </div>
  );
}
