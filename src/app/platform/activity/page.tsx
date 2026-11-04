import Link from "next/link";
import type { ActivityType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { LogType } from "@/components/ui/JournalBlocks";
import { Icon } from "@/components/ui/Icon";
import { TableFrame } from "@/components/ui/TableFrame";
import { parseListPage } from "@/lib/list-query";
import { paginate } from "@/lib/paginate";
import { UrlPagination } from "@/components/ui/Pagination";

const TYPES: ActivityType[] = [
  "REGISTRATION_CREATED",
  "REGISTRATION_APPROVED",
  "REGISTRATION_REJECTED",
  "REGISTRATION_UPDATED",
  "REGISTRATION_DELETED",
  "REGISTRATION_RESUBMITTED",
  "BADGE_PRINTED",
  "BADGE_BATCH_PRINTED",
  "BADGE_EXPORTED",
  "BADGE_SCANNED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DELETED",
  "USER_PASSWORD_SET",
  "USER_LOGIN",
  "ORG_CREATED",
  "ORG_UPDATED",
  "ORG_ARCHIVED",
  "ORG_RESTORED",
  "EVENT_CREATED",
  "EVENT_UPDATED",
  "EVENT_ARCHIVED",
  "EVENT_RESTORED",
  "MEMBERSHIP_ADDED",
  "MEMBERSHIP_REMOVED",
  "MEMBERSHIP_ROLE_CHANGED",
  "PLATFORM_SETTINGS_UPDATED",
  "EVENT_SETTINGS_UPDATED",
  "USER_REGISTERED",
  "USER_EMAIL_VERIFIED",
  "USER_PASSWORD_RESET_REQUESTED",
  "USER_PASSWORD_RESET_COMPLETED",
  "USER_PROFILE_UPDATED",
  "USER_BLOCKED",
  "USER_UNBLOCKED",
];

// Mappe un ActivityType sur une categorie visuelle de LogType.
export function logKind(
  t: ActivityType,
): "creation" | "modification" | "suppression" | "systeme" | "connexion" | "acces" {
  const s = String(t);
  if (s === "USER_LOGIN") return "connexion";
  if (
    s.endsWith("_CREATED") ||
    s === "MEMBERSHIP_ADDED" ||
    s === "USER_REGISTERED" ||
    s === "ORG_RESTORED" ||
    s === "EVENT_RESTORED"
  )
    return "creation";
  if (s.endsWith("_DELETED") || s.endsWith("_ARCHIVED") || s === "MEMBERSHIP_REMOVED" || s === "USER_BLOCKED")
    return "suppression";
  if (s === "BADGE_SCANNED" || s.endsWith("_PRINTED") || s.endsWith("_EXPORTED")) return "acces";
  if (
    s.endsWith("_UPDATED") ||
    s === "MEMBERSHIP_ROLE_CHANGED" ||
    s.endsWith("SETTINGS_UPDATED") ||
    s === "USER_PASSWORD_SET"
  )
    return "modification";
  return "systeme";
}

const FIELD_CLASS = "block rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-700";

export default async function StaffActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    orgId?: string;
    userId?: string;
    eventId?: string;
    staffActor?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const sp = await searchParams;
  const list = parseListPage(sp);

  const where: Prisma.ActivityLogWhereInput = {};
  if (sp.type) where.type = sp.type as ActivityType;
  if (sp.orgId) where.orgId = sp.orgId;
  if (sp.userId) where.userId = sp.userId;
  if (sp.eventId) where.eventId = sp.eventId;
  if (sp.staffActor === "true") where.staffActor = true;
  else if (sp.staffActor === "false") where.staffActor = false;

  if (sp.from || sp.to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (sp.from) {
      const d = new Date(sp.from);
      if (!Number.isNaN(d.getTime())) range.gte = d;
    }
    if (sp.to) {
      const d = new Date(sp.to);
      if (!Number.isNaN(d.getTime())) range.lte = d;
    }
    if (range.gte || range.lte) where.createdAt = range;
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
          orgId: true,
          eventId: true,
          targetId: true,
          staffActor: true,
          createdAt: true,
          user: { select: { id: true, email: true, name: true } },
        },
      }),
  );
  const activities = result.rows;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Journal d&apos;activité</h1>
        <p className="mt-0.5 text-sm text-slate-400">Toutes les actions de la plateforme</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2.5">
        <input type="hidden" name="pageSize" value={result.pageSize} />
        <label className="text-[13px] text-slate-500">
          <div className="mb-1">Type</div>
          <select name="type" defaultValue={sp.type ?? ""} className={FIELD_CLASS}>
            <option value="">Tous</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] text-slate-500">
          <div className="mb-1">Staff</div>
          <select name="staffActor" defaultValue={sp.staffActor ?? "all"} className={FIELD_CLASS}>
            <option value="all">Tous</option>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
        </label>
        <label className="text-[13px] text-slate-500">
          <div className="mb-1">Du</div>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className={FIELD_CLASS} />
        </label>
        <label className="text-[13px] text-slate-500">
          <div className="mb-1">Au</div>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className={FIELD_CLASS} />
        </label>
        <label className="text-[13px] text-slate-500">
          <div className="mb-1">Org ID</div>
          <input name="orgId" defaultValue={sp.orgId ?? ""} className={FIELD_CLASS} />
        </label>
        <label className="text-[13px] text-slate-500">
          <div className="mb-1">User ID</div>
          <input name="userId" defaultValue={sp.userId ?? ""} className={FIELD_CLASS} />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Filtrer
        </button>
      </form>

      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Horodatage</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3 hidden md:table-cell">Auteur</th>
              <th className="px-4 py-3 hidden md:table-cell">Contexte</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                  Aucune entrée.
                </td>
              </tr>
            )}
            {activities.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-400">
                  {new Date(a.createdAt).toLocaleString("fr-FR")}
                </td>
                <td className="px-4 py-3">
                  <LogType kind={logKind(a.type)}>{a.type}</LogType>
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-600 hidden md:table-cell">{a.user?.email ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">
                  {a.orgId && <div>org : {a.orgId}</div>}
                  {a.eventId && <div>event : {a.eventId}</div>}
                  {a.targetId && <div>cible : {a.targetId}</div>}
                  {!a.orgId && !a.eventId && !a.targetId && "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/platform/activity/${a.id}`}
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
