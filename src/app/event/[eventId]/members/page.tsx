import { prisma } from "@/lib/prisma";
import { MemberTable } from "@/components/event/MemberTable";
import { getEventOrgId } from "@/lib/event-org";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;
  const list = parseListPage(await searchParams);
  const orgId = await getEventOrgId(eventId);
  const result = await paginate(
    list,
    () => prisma.eventMembership.count({ where: { eventId } }),
    (range) =>
      prisma.eventMembership.findMany({
        where: { eventId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...range,
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: { select: { id: true, email: true, name: true, isStaff: true } },
        },
      }),
  );
  const serialised = result.rows.map((m) => ({ ...m, role: m.role ?? "VIEWER", createdAt: m.createdAt.toISOString() }));
  return <MemberTable orgId={orgId} eventId={eventId} rows={serialised} footer={<UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />} />;
}
