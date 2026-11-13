import { prisma } from "@/lib/prisma";
import { GenerationsScreen } from "@/components/staff/print/GenerationsScreen";
import type { GenerationRow } from "@/components/staff/print/GenerationList";
import { loadLayoutOptions, requireSheetsStaff } from "../sheets-data";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

export const dynamic = "force-dynamic";

export default async function FreeSheetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { canGenerate } = await requireSheetsStaff();
  const list = parseListPage(await searchParams);
  // Historique de la génération libre : les planches de commande ont leur sous-page.
  const where = { output: "SHEETS", printRequestId: null } as const;
  const [layouts, result] = await Promise.all([
    loadLayoutOptions(),
    paginate(
      list,
      () => prisma.printSheetGeneration.count({ where }),
      (range) =>
    prisma.printSheetGeneration.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...range,
      select: {
        id: true,
        status: true,
        duplex: true,
        badgeCount: true,
        sheetCount: true,
        skippedIds: true,
        error: true,
        createdAt: true,
        event: { select: { id: true, title: true } },
        layout: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    ),
  ]);
  const initial = result.rows.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() })) as GenerationRow[];
  return (
    <GenerationsScreen
      layouts={layouts}
      canGenerate={canGenerate}
      initial={initial}
      pagination={<UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />}
    />
  );
}
