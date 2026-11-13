import { listOrdersToGenerate } from "@/lib/print-sheets/order-queue";
import { OrderQueueTable } from "@/components/staff/print/sheets/OrderQueueTable";
import { loadLayoutOptions, requireSheetsStaff } from "../sheets-data";
import { parseListPage } from "@/lib/list-query";
import { paginateArray } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

export const dynamic = "force-dynamic";

export default async function PendingSheetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { canGenerate } = await requireSheetsStaff();
  const [orders, layouts] = await Promise.all([listOrdersToGenerate(), loadLayoutOptions()]);
  // La file est calculee en entier par la lib : la tranche est prise ici.
  const result = paginateArray(orders, parseListPage(await searchParams));
  return (
    <div className="space-y-4">
      <OrderQueueTable mode="pending" initial={result.rows} layouts={layouts} canGenerate={canGenerate} />
      <UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />
    </div>
  );
}
