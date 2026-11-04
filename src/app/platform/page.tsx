import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Timeline, TimelineItem } from "@/components/ui/Timeline";
import { OrgLogo } from "@/components/ui/PickCard";
import { EmptyState } from "@/components/ui/Feedback";

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

  const topMax = topOrgs[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tableau de bord</h1>
        <p className="mt-1 text-sm text-slate-400">Vue d&apos;ensemble de la plateforme</p>
      </div>

      <StatGrid cols={4}>
        <StatCard label="Organisations actives" value={orgsActive} icon="building-2" />
        <StatCard label="Organisations archivées" value={orgsArchived} icon="archive" />
        <StatCard label="Événements actifs" value={eventsActive} icon="calendar" />
        <StatCard label="Inscriptions cumulées" value={registrationsTotal.toLocaleString("fr-FR")} icon="user-check" />
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHead
            title="Top organisations"
            subtitle="Par inscriptions ce mois-ci"
            action={
              <Link href="/platform/organizations" className="text-[13px] font-medium text-navy hover:underline">
                Tout voir
              </Link>
            }
          />
          <CardBody className="space-y-3">
            {topOrgs.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune inscription ce mois-ci.</p>
            ) : (
              topOrgs.map((o) => (
                <div key={o.orgId} className="flex items-center gap-3">
                  <OrgLogo name={o.name} size={32} />
                  <Link href={`/platform/organizations/${o.orgId}`} className="flex-1 text-sm text-slate-900 hover:underline">
                    {o.name}
                  </Link>
                  <div className="w-28">
                    <div className="h-2 overflow-hidden rounded-full bg-mist">
                      <div
                        className="h-full rounded-full bg-navy"
                        style={{ width: `${Math.round((o.count / topMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-14 text-right text-sm tabular-nums text-slate-500">
                    {o.count.toLocaleString("fr-FR")}
                  </span>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Activité récente"
            action={
              <Link href="/platform/activity" className="text-[13px] font-medium text-navy hover:underline">
                Tout voir
              </Link>
            }
          />
          <CardBody>
            {recentActivity.length === 0 ? (
              <EmptyState icon="scroll-text" title="Aucune activité récente" />
            ) : (
              <Timeline>
                {recentActivity.map((a) => (
                  <TimelineItem
                    key={a.id}
                    tone={a.staffActor ? "warn" : "ok"}
                    title={a.type}
                    meta={`${a.staffActor ? "Staff · " : ""}${new Date(a.createdAt).toLocaleString("fr-FR")}`}
                  />
                ))}
              </Timeline>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
