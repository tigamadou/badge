import { prisma } from "@/lib/prisma";
import { countCountableRegistrations } from "@/lib/subscription";
import { Tag } from "@/components/ui/Labels";
import { TableFrame } from "@/components/ui/TableFrame";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

// v4 Bloc B : liste read-only des evenements d'une org, pour la supervision staff.
// Aucun lien vers l'espace org : le staff agit via l'API (pouvoir staff), pas via /org.
export default async function OrgEventsSupervisionPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const list = parseListPage(await searchParams);
  const result = await paginate(
    list,
    () => prisma.event.count({ where: { orgId } }),
    (range) =>
      prisma.event.findMany({
        where: { orgId },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        ...range,
        select: {
          id: true,
          title: true,
          date: true,
          registrationOpen: true,
          archived: true,
        },
      }),
  );
  const events = result.rows;
  const countable = await Promise.all(events.map((e) => countCountableRegistrations(e.id)));

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-800">Événements ({result.total})</h2>
      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Événement</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Inscriptions</th>
              <th className="px-4 py-3">Inscriptions comptables</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">
                  Aucun événement.
                </td>
              </tr>
            )}
            {events.map((e, i) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 text-slate-900">
                    {e.title}
                    {e.archived && <Tag icon="archive">archivé</Tag>}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-500">
                  {new Date(e.date).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {e.registrationOpen ? "Ouvertes" : "Fermées"}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-500">{countable[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
      <UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />
    </div>
  );
}
