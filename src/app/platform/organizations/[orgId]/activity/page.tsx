import { prisma } from "@/lib/prisma";
import { LogType } from "@/components/ui/JournalBlocks";
import { logKind } from "@/app/platform/activity/page";
import { TableFrame } from "@/components/ui/TableFrame";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

// v4 Bloc B : journal read-only filtre sur l'org, pour la supervision staff.
export default async function OrgActivitySupervisionPage({
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
    () => prisma.activityLog.count({ where: { orgId } }),
    (range) =>
      prisma.activityLog.findMany({
        where: { orgId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...range,
        select: {
          id: true,
          type: true,
          eventId: true,
          targetId: true,
          staffActor: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
  );
  const activities = result.rows;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-800">Journal d&apos;activité ({result.total})</h2>
      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mist text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Horodatage</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Auteur</th>
              <th className="px-4 py-3">Contexte</th>
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">
                  Aucune entrée.
                </td>
              </tr>
            )}
            {activities.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs text-slate-400">
                  {new Date(a.createdAt).toLocaleString("fr-FR")}
                </td>
                <td className="px-4 py-3">
                  <LogType kind={logKind(a.type)}>{a.type}</LogType>
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-600">
                  {a.user?.email ?? "—"}
                  {a.staffActor && <span className="ml-1 text-[11px] text-warn">(staff)</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {a.eventId && <div>event : {a.eventId}</div>}
                  {a.targetId && <div>cible : {a.targetId}</div>}
                  {!a.eventId && !a.targetId && "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableFrame>
      <UrlPagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} />
    </div>
  );
}
