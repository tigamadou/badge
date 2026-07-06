import Link from "next/link";

import { prisma } from "@/lib/prisma";

export default async function StaffDashboardPage() {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    orgsActive,
    orgsArchived,
    eventsActive,
    registrationsTotal,
    topOrgsRaw,
    recentActivity,
  ] = await Promise.all([
    prisma.organization.count({ where: { archived: false } }),
    prisma.organization.count({ where: { archived: true } }),
    prisma.event.count({ where: { archived: false } }),
    prisma.registration.count(),
    prisma.registration.groupBy({
      by: ["eventId"],
      where: { createdAt: { gte: monthStart } },
      _count: { _all: true },
      orderBy: { _count: { eventId: "desc" } },
      take: 20,
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        createdAt: true,
        staffActor: true,
        orgId: true,
        eventId: true,
        userId: true,
      },
    }),
  ]);

  const eventIds = topOrgsRaw.map((r) => r.eventId);
  const events =
    eventIds.length > 0
      ? await prisma.event.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, title: true, orgId: true, organization: { select: { name: true } } },
        })
      : [];
  const eventById = new Map(events.map((e) => [e.id, e]));

  const orgCounts = new Map<string, { name: string; count: number }>();
  for (const r of topOrgsRaw) {
    const ev = eventById.get(r.eventId);
    if (!ev) continue;
    const prev = orgCounts.get(ev.orgId) ?? { name: ev.organization.name, count: 0 };
    orgCounts.set(ev.orgId, { name: prev.name, count: prev.count + r._count._all });
  }
  const topOrgs = Array.from(orgCounts.entries())
    .map(([orgId, { name, count }]) => ({ orgId, name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord plateforme</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Organisations actives" value={orgsActive} />
        <Kpi label="Organisations archivees" value={orgsArchived} />
        <Kpi label="Evenements actifs" value={eventsActive} />
        <Kpi label="Inscriptions cumulees" value={registrationsTotal} />
      </div>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Top organisations (mois en cours)</h2>
          <Link href="/staff/organizations" className="text-sm text-green-600 hover:underline">
            Tout voir
          </Link>
        </div>
        <ul className="bg-white border rounded divide-y">
          {topOrgs.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">
              Aucune inscription ce mois-ci.
            </li>
          )}
          {topOrgs.map((o) => (
            <li key={o.orgId} className="px-4 py-3 flex justify-between text-sm">
              <Link
                href={`/staff/organizations/${o.orgId}`}
                className="hover:underline"
              >
                {o.name}
              </Link>
              <span className="text-slate-500">{o.count} inscriptions</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Journal recent</h2>
          <Link href="/staff/activity" className="text-sm text-green-600 hover:underline">
            Tout voir
          </Link>
        </div>
        <ul className="bg-white border rounded divide-y">
          {recentActivity.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">Aucune activite recente.</li>
          )}
          {recentActivity.map((a) => (
            <li key={a.id} className="px-4 py-3 text-sm flex justify-between">
              <span>
                {a.type}
                {a.staffActor && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                    staff
                  </span>
                )}
              </span>
              <span className="text-slate-500 text-xs">
                {new Date(a.createdAt).toLocaleString("fr-FR")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-slate-200 p-4 bg-white">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
