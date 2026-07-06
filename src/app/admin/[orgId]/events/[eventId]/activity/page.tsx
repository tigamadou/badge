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

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
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

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      staffActor: true,
      details: true,
      targetId: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Journal d&apos;activité</h1>
        <p className="mt-0.5 text-sm text-slate-400">Les actions réalisées sur cet événement</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Horodatage</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Auteur</th>
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
                <td className="px-4 py-3 text-[13px] text-slate-600">
                  {l.user ? l.user.email : "Système"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/${orgId}/events/${eventId}/activity/${l.id}`}
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
      </div>
    </div>
  );
}
