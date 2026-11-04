import { prisma } from "@/lib/prisma";
import { CategoryTable } from "@/components/event/CategoryTable";
import { getEventOrgId } from "@/lib/event-org";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

export default async function CategoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;
  const list = parseListPage(await searchParams);
  const orgId = await getEventOrgId(eventId);
  const [result, allCategories] = await Promise.all([
    paginate(
      list,
      () => prisma.category.count({ where: { eventId } }),
      (range) =>
        prisma.category.findMany({
          where: { eventId },
          orderBy: [{ number: "asc" }, { name: "asc" }],
          ...range,
          select: {
            id: true,
            name: true,
            color: true,
            number: true,
            neutralBadge: true,
            anonymous: true,
            _count: { select: { registrations: true } },
          },
        }),
    ),
    // Cibles possibles d'une reaffectation : toutes les categories, pas seulement la page affichee.
    prisma.category.findMany({
      where: { eventId },
      orderBy: [{ number: "asc" }, { name: "asc" }],
      select: { id: true, name: true, number: true },
    }),
  ]);
  return (
    <CategoryTable
      orgId={orgId}
      eventId={eventId}
      rows={result.rows}
      allCategories={allCategories}
      footer={<UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />}
    />
  );
}
