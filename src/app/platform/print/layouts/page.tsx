import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { prisma } from "@/lib/prisma";
import { LayoutList } from "@/components/staff/print/LayoutList";
import {
  canWriteLayouts,
  toLayoutRow,
} from "@/lib/print-sheets/layout-page-data";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

export default async function PrintLayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const list = parseListPage(await searchParams);
  const [canWrite, result] = await Promise.all([
    canWriteLayouts(),
    paginate(
      list,
      () => prisma.printSheetLayout.count({ where: { archived: false } }),
      (range) =>
        prisma.printSheetLayout.findMany({
          where: { archived: false },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          ...range,
        }),
    ),
  ]);
  const layouts = result.rows;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Gabarits d&apos;impression</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Formats de planche, marges et espacements utilisés pour imprimer les badges
          </p>
        </div>
        {canWrite && (
          <Link
            href="/platform/print/layouts/new"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <Icon name="plus" size={16} /> Nouveau gabarit
          </Link>
        )}
      </div>
      <LayoutList
        layouts={layouts.map(toLayoutRow)}
        canWrite={canWrite}
      />
      <UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />
    </div>
  );
}
