import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { countCountableRegistrations, resolveOrgLimits } from "@/lib/subscription";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";
import { PublicLinkCard } from "@/components/event/PublicLinkCard";
import { EventInfoCard } from "@/components/event/EventInfoCard";
import { EventCover, eventCoverUrl } from "@/components/event/EventCover";
import { EventImageAlert } from "@/components/event/EventImageAlert";
import { buildBaseUrl } from "@/lib/mail-helpers";
import { EVENT_IMAGE_SELECT, evaluateEventImages } from "@/lib/event-image-compliance";
import { firstAllowedEventHref } from "@/components/event/event-nav";
import { requireEventPagePermission } from "./_lib/page-access";

const SHORTCUT_LINK = "flex items-center justify-center gap-2 rounded-xl p-4 text-sm font-medium";

export default async function EventDashboardPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { ctx, permissions, orgId } = await requireEventPagePermission(eventId, null, `/event/${eventId}`);

  // Atterrissage : le tableau de bord s'affiche pour qui détient l'une de ses permissions ; les autres
  // sont envoyés sur la première entrée de leur menu (même modèle que le menu, donc sans boucle).
  const aggregated = permissions.has("event.read.aggregated");
  const detailed = permissions.has("event.read.detailed");
  const canScan = permissions.has("scan.check-in");
  if (!aggregated && !detailed && !canScan) {
    redirect(firstAllowedEventHref(eventId, permissions) ?? "/select");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      title: true,
      slug: true,
      date: true,
      endDate: true,
      location: true,
      description: true,
      registrationOpen: true,
      ...EVENT_IMAGE_SELECT,
    },
  });
  if (!event) redirect("/select");

  const coverUrl = eventCoverUrl(event.banner);
  const canOnsite = permissions.has("print.onsite.operate");
  const myScans = canScan
    ? await prisma.activityLog.count({ where: { type: "BADGE_SCANNED", userId: ctx.user.id, eventId } })
    : 0;

  const scannerBlock = canScan && (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <StatCard label="Mes scans" value={myScans} icon="scan-line" />
      <Link href={`/event/${eventId}/scan`} className={`${SHORTCUT_LINK} bg-navy text-white hover:bg-navy-hover`}>
        <Icon name="scan-line" size={18} /> Ouvrir le scanner
      </Link>
    </div>
  );

  // Sans lecture des chiffres de l'évènement : tableau de bord réduit à ses propres scans et au poste sur place.
  if (!aggregated && !detailed) {
    return (
      <div className="max-w-xl space-y-6">
        <EventCover bannerUrl={coverUrl} title={event.title} variant="hero" />
        <h1 className="text-xl font-semibold text-navy">Tableau de bord opérateur</h1>
        {scannerBlock}
        {canOnsite && (
          <Card>
            <CardHead title="Poste sur place" />
            <CardBody>
              <Link
                href={`/event/${eventId}/print/onsite`}
                className={`${SHORTCUT_LINK} border border-slate-200 text-navy hover:bg-mist`}
              >
                <Icon name="printer" size={18} /> Ouvrir le poste d&apos;impression sur place
              </Link>
            </CardBody>
          </Card>
        )}
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
      // Données nominatives : seulement avec la lecture détaillée.
      detailed
        ? prisma.registration.findMany({
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
          })
        : [],
      detailed ? countCountableRegistrations(eventId) : 0,
    ]);

  const categories = await prisma.category.findMany({
    where: { eventId },
    orderBy: { number: "asc" },
    select: { id: true, name: true, color: true },
  });

  // Le bandeau renvoie vers les paramètres : seulement pour qui peut les ouvrir.
  const imageIssues = permissions.has("event.settings.update")
    ? await evaluateEventImages(event, { lenient: true })
    : [];
  const participantLimit = detailed ? (await resolveOrgLimits(orgId)).maxParticipantsPerEvent : null;
  const quotaPct = participantLimit != null ? Math.round((quota30d / participantLimit) * 100) : null;

  return (
    <div className="space-y-6">
      <EventCover bannerUrl={coverUrl} title={event.title} variant="hero" />
      <div>
        <h1 className="text-xl font-semibold text-navy">{event.title}</h1>
        <p className="mt-0.5 text-sm text-slate-400">Tableau de bord de l&apos;événement</p>
      </div>

      <EventInfoCard
        event={{
          title: event.title,
          date: event.date,
          endDate: event.endDate,
          location: event.location,
          description: event.description,
          registrationOpen: event.registrationOpen,
        }}
        categories={categories}
        variant="staff"
      />

      <EventImageAlert eventId={eventId} issues={imageIssues} />

      {quotaPct != null && quotaPct > 80 && (
        <Alert tone="warn">
          <Icon name="alert-triangle" size={16} /> Le quota d&apos;inscriptions dépasse 80 %.
        </Alert>
      )}

      <PublicLinkCard
        path={`/e/${event.slug}`}
        fallbackBaseUrl={buildBaseUrl({
          BASE_URL: process.env.BASE_URL,
          NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        })}
        registrationOpen={event.registrationOpen}
      />

      {scannerBlock}

      {aggregated && (
        <>
          <StatGrid cols={4}>
            <StatCard label="En attente" value={pending} icon="clock" />
            <StatCard label="Approuvées" value={approved} icon="user-check" />
            <StatCard label="Rejetées" value={rejected} icon="x" />
            <StatCard label="Badges imprimés" value={badgesPrinted} icon="id-card" />
          </StatGrid>

          <StatGrid cols={detailed ? 3 : 4}>
            <StatCard label="Scans aujourd'hui" value={scansToday} icon="scan-line" />
            <StatCard label="Scans total" value={scansTotal} icon="scan-line" />
            {detailed && (
              <StatCard
                label="Quota inscriptions"
                value={participantLimit != null ? `${quota30d} / ${participantLimit}` : "—"}
                icon="user-check"
              />
            )}
          </StatGrid>
        </>
      )}

      {detailed && (
        <Card>
          <CardHead
            title="Dernières inscriptions"
            action={
              <Link
                href={`/event/${eventId}/registrations`}
                className="text-[13px] font-medium text-navy hover:underline"
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
                  href={`/event/${eventId}/registrations/${r.id}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm hover:text-navy"
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
      )}
    </div>
  );
}
