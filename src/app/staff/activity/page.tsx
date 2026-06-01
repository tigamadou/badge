import type { ActivityType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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
  }>;
}) {
  const sp = await searchParams;

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

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 50;

  const [activities, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    prisma.activityLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Journal d&apos;activite</h1>

      <form
        method="get"
        className="flex flex-wrap gap-2 items-end bg-white border rounded p-3"
      >
        <label className="text-sm">
          <div className="text-slate-600">Type</div>
          <select
            name="type"
            defaultValue={sp.type ?? ""}
            className="block rounded border px-2 py-1 text-sm"
          >
            <option value="">Tous</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="text-slate-600">Staff?</div>
          <select
            name="staffActor"
            defaultValue={sp.staffActor ?? "all"}
            className="block rounded border px-2 py-1 text-sm"
          >
            <option value="all">Tous</option>
            <option value="true">Oui</option>
            <option value="false">Non</option>
          </select>
        </label>
        <label className="text-sm">
          <div className="text-slate-600">Du</div>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="block rounded border px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm">
          <div className="text-slate-600">Au</div>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="block rounded border px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm">
          <div className="text-slate-600">Org ID</div>
          <input
            name="orgId"
            defaultValue={sp.orgId ?? ""}
            className="block rounded border px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm">
          <div className="text-slate-600">User ID</div>
          <input
            name="userId"
            defaultValue={sp.userId ?? ""}
            className="block rounded border px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-slate-800 text-white px-3 py-1.5 text-sm"
        >
          Filtrer
        </button>
      </form>

      <div className="text-sm text-slate-500">
        {total} entree{total > 1 ? "s" : ""} — page {page} / {totalPages}
      </div>

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Acteur</th>
            <th className="px-3 py-2">Cible</th>
            <th className="px-3 py-2">Staff?</th>
          </tr>
        </thead>
        <tbody>
          {activities.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                Aucune entree.
              </td>
            </tr>
          )}
          {activities.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="px-3 py-2 text-xs text-slate-500">
                {new Date(a.createdAt).toLocaleString("fr-FR")}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{a.type}</td>
              <td className="px-3 py-2">{a.user?.email ?? "—"}</td>
              <td className="px-3 py-2 text-xs">
                {a.orgId && <div>org: {a.orgId}</div>}
                {a.eventId && <div>event: {a.eventId}</div>}
                {a.targetId && <div>target: {a.targetId}</div>}
              </td>
              <td className="px-3 py-2">
                {a.staffActor ? (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                    staff
                  </span>
                ) : (
                  <span className="text-slate-500 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
