import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { effectiveEventRole } from "@/lib/auth-helpers";
import { countCountableRegistrations } from "@/lib/event-quota";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

export default async function EventDashboardPage({
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
    select: {
      id: true,
      orgId: true,
      title: true,
      organization: { select: { quotaMaxRegistrations: true } },
    },
  });
  if (!event || event.orgId !== orgId) redirect("/select");

  const role = effectiveEventRole(ctx, event.id, event.orgId);

  if (role === "OPERATOR") {
    const myScans = await prisma.activityLog.count({
      where: { type: "BADGE_SCANNED", userId: ctx.user.id, eventId },
    });
    return (
      <div className="max-w-xl space-y-6">
        <h1 className="text-xl font-semibold text-slate-900">Tableau de bord opérateur</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard label="Mes scans" value={myScans} icon="scan-line" />
          <Link
            href={`/admin/${orgId}/events/${eventId}/scan`}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 p-4 text-sm font-medium text-white hover:bg-green-700"
          >
            <Icon name="scan-line" size={18} /> Ouvrir le scanner
          </Link>
        </div>
      </div>
    );
  }

  const [pending, approved, rejected, badgesPrinted, scansToday, scansTotal, latest, quota30d] =
    await Promise.all([
      prisma.registration.count({ where: { eventId, status: "PENDING" } }),
      prisma.registration.count({ where: { eventId, status: "APPROVED" } }),
      prisma.registration.count({ where: { eventId, status: "REJECTED" } }),
      prisma.registration.count({ where: { eventId, badgePrinted: true } }),
      prisma.activityLog.count({
        where: {
          type: "BADGE_SCANNED",
          eventId,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      prisma.activityLog.count({ where: { type: "BADGE_SCANNED", eventId } }),
      prisma.registration.findMany({
        where: { eventId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          snapshotFirstName: true,
          snapshotLastName: true,
          snapshotEmail: true,
          status: true,
          createdAt: true,
        },
      }),
      countCountableRegistrations(eventId),
    ]);

  const quotaMax = event.organization.quotaMaxRegistrations;
  const quotaPct = quotaMax != null ? Math.round((quota30d / quotaMax) * 100) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{event.title}</h1>
        <p className="mt-0.5 text-sm text-slate-400">Tableau de bord de l&apos;événement</p>
      </div>

      {quotaPct != null && quotaPct > 80 && (
        <Alert tone="warn">
          <Icon name="alert-triangle" size={16} /> Le quota d&apos;inscriptions dépasse 80 %.
        </Alert>
      )}

      <StatGrid cols={4}>
        <StatCard label="En attente" value={pending} icon="clock" />
        <StatCard label="Approuvées" value={approved} icon="user-check" />
        <StatCard label="Rejetées" value={rejected} icon="x" />
        <StatCard label="Badges imprimés" value={badgesPrinted} icon="id-card" />
      </StatGrid>

      <StatGrid cols={3}>
        <StatCard label="Scans aujourd'hui" value={scansToday} icon="scan-line" />
        <StatCard label="Scans total" value={scansTotal} icon="scan-line" />
        <StatCard
          label="Quota inscriptions"
          value={quotaMax != null ? `${quota30d} / ${quotaMax}` : "—"}
          icon="user-check"
        />
      </StatGrid>

      <Card>
        <CardHead
          title="Dernières inscriptions"
          action={
            <Link
              href={`/admin/${orgId}/events/${eventId}/registrations`}
              className="text-[13px] font-medium text-green-600 hover:underline"
            >
              Tout voir
            </Link>
          }
        />
        <CardBody className="divide-y divide-slate-100 !py-0">
          {latest.length === 0 ? (
            <div className="py-2">
              <EmptyState icon="user-check" title="Aucune inscription pour le moment" />
            </div>
          ) : (
            latest.map((r) => (
              <Link
                key={r.id}
                href={`/admin/${orgId}/events/${eventId}/registrations/${r.id}`}
                className="flex items-center justify-between gap-3 py-3 text-sm hover:text-green-600"
              >
                <span>
                  <span className="font-medium text-slate-900">
                    {r.snapshotFirstName} {r.snapshotLastName}
                  </span>{" "}
                  <span className="text-slate-400">— {r.snapshotEmail}</span>
                </span>
                <span className="flex items-center gap-3">
                  <StatusBadge status={r.status} />
                  <span className="text-xs tabular-nums text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </span>
              </Link>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
