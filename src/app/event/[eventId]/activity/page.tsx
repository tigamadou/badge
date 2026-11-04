import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { effectiveEventRole } from "@/lib/auth-helpers";
import { LogType } from "@/components/ui/JournalBlocks";
import { Tag } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";
import { logKind } from "@/lib/activity-labels";
import { getEventOrgId } from "@/lib/event-org";
import { TableFrame } from "@/components/ui/TableFrame";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { eventId } = await params;
  const list = parseListPage(await searchParams);
  const orgId = await getEventOrgId(eventId);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event || event.orgId !== orgId) notFound();

  const role = effectiveEventRole(ctx, eventId, orgId);
  if (role !== "STAFF" && role !== "ADMIN" && role !== "OPERATOR") {
    notFound();
  }

  const where: Prisma.ActivityLogWhereInput = { eventId };
  if (role === "OPERATOR") {
    where.userId = ctx.user.id;
    where.type = "BADGE_SCANNED";
  }

  const result = await paginate(
    list,
    () => prisma.activityLog.count({ where }),
    (range) =>
      prisma.activityLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...range,
        select: {
          id: true,
          type: true,
          staffActor: true,
          details: true,
          targetId: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
  );
  const logs = result.rows;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Journal d&apos;activité</h1>
        <p className="mt-0.5 text-sm text-slate-400">Les actions réalisées sur cet événement</p>
      </div>

      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Horodatage</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3 hidden md:table-cell">Auteur</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">
                  Aucune activité.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-400">
                  {new Date(l.createdAt).toLocaleString("fr-FR")}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <LogType kind={logKind(l.type)}>{l.type}</LogType>
                    {l.staffActor && <Tag icon="shield">staff</Tag>}
                  </span>
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-600 hidden md:table-cell">
                  {l.user ? l.user.email : "Système"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/event/${eventId}/activity/${l.id}`}
                    aria-label="Voir le détail"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Icon name="chevron-right" size={16} />
                  </Link>
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
