import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { Timeline, TimelineItem } from "@/components/ui/Timeline";
import { Tag } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";
import { logKind } from "@/lib/activity-labels";
import { resolveOrgLimits } from "@/lib/subscription";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const [eventsActive, eventsArchived, registrationsThisMonth, latestEvents, recentActivity, limits] =
    await Promise.all([
      prisma.event.count({ where: { orgId, archived: false } }),
      prisma.event.count({ where: { orgId, archived: true } }),
      prisma.registration.count({
        where: {
          event: { orgId },
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      prisma.event.findMany({
        where: { orgId, archived: false },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, slug: true, date: true, registrationOpen: true },
      }),
      prisma.activityLog.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, type: true, createdAt: true, staffActor: true, details: true },
      }),
      resolveOrgLimits(orgId),
    ]);

  const maxEvents = limits.maxEvents;
  const eventsPct = maxEvents != null ? Math.round((eventsActive / maxEvents) * 100) : null;

  const quotaWarning = eventsPct != null && eventsPct > 80;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Tableau de bord</h1>
        <p className="mt-0.5 text-sm text-slate-400">Vue d&apos;ensemble de votre organisation</p>
      </div>

      {quotaWarning && (
        <Alert tone="warn">
          <Icon name="alert-triangle" size={16} /> Un quota dépasse 80 %. Contactez le support si vous prévoyez
          d&apos;aller plus loin.
        </Alert>
      )}

      <StatGrid cols={4}>
        <StatCard label="Événements actifs" value={eventsActive} icon="calendar" />
        <StatCard label="Événements archivés" value={eventsArchived} icon="archive" />
        <StatCard label="Inscriptions ce mois" value={registrationsThisMonth.toLocaleString("fr-FR")} icon="user-check" />
        <StatCard
          label="Quota événements"
          value={maxEvents != null ? `${eventsActive} / ${maxEvents}` : "—"}
          icon="hard-drive"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHead
            title="Derniers événements"
            action={
              <Link href={`/org/${orgId}/events`} className="text-[13px] font-medium text-green-600 hover:underline">
                Tout voir
              </Link>
            }
          />
          <CardBody className="divide-y divide-slate-100 !py-0">
            {latestEvents.length === 0 ? (
              <div className="py-2">
                <EmptyState icon="calendar" title="Aucun événement" />
              </div>
            ) : (
              latestEvents.map((e) => (
                <Link
                  key={e.id}
                  href={`/event/${e.id}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm hover:text-green-600"
                >
                  <span className="text-slate-900">{e.title}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    {new Date(e.date).toLocaleDateString("fr-FR")}
                    {e.registrationOpen && <Tag icon="check">inscriptions ouvertes</Tag>}
                  </span>
                </Link>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Activité récente" />
          <CardBody>
            {recentActivity.length === 0 ? (
              <EmptyState icon="scroll-text" title="Aucune activité récente" />
            ) : (
              <Timeline>
                {recentActivity.map((a) => (
                  <TimelineItem
                    key={a.id}
                    tone={a.staffActor ? "warn" : logKind(a.type) === "suppression" ? "danger" : "ok"}
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
