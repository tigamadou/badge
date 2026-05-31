import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const [eventsActive, eventsArchived, registrationsThisMonth, latestEvents, recentActivity, org] =
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
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { quotaMaxEvents: true, quotaMaxRegistrations: true },
      }),
    ]);

  const eventsPct =
    org?.quotaMaxEvents != null ? Math.round((eventsActive / org.quotaMaxEvents) * 100) : null;
  const regsPct =
    org?.quotaMaxRegistrations != null
      ? Math.round((registrationsThisMonth / org.quotaMaxRegistrations) * 100)
      : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Événements actifs" value={eventsActive} />
        <Kpi label="Événements archivés" value={eventsArchived} />
        <Kpi label="Inscriptions ce mois" value={registrationsThisMonth} />
        <Kpi
          label="Quota events"
          value={org?.quotaMaxEvents != null ? `${eventsActive}/${org.quotaMaxEvents}` : "—"}
          warn={eventsPct != null && eventsPct > 80}
        />
      </div>

      {(eventsPct != null && eventsPct > 80) || (regsPct != null && regsPct > 80) ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Un quota dépasse 80 %. Contactez le support si vous prévoyez d&apos;aller plus loin.
        </div>
      ) : null}

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Derniers événements</h2>
          <Link href={`/admin/${orgId}/events`} className="text-sm text-blue-600 hover:underline">
            Tout voir
          </Link>
        </div>
        <ul className="bg-white border rounded divide-y">
          {latestEvents.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">Aucun événement pour le moment.</li>
          )}
          {latestEvents.map((e) => (
            <li key={e.id} className="px-4 py-3 flex justify-between">
              <Link href={`/admin/${orgId}/events/${e.id}`} className="text-sm hover:underline">
                {e.title}
              </Link>
              <span className="text-xs text-gray-500">
                {new Date(e.date).toLocaleDateString("fr-FR")}
                {e.registrationOpen ? " — inscriptions ouvertes" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Journal récent</h2>
        <ul className="bg-white border rounded divide-y">
          {recentActivity.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">Aucune activité récente.</li>
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
              <span className="text-gray-500 text-xs">
                {new Date(a.createdAt).toLocaleString("fr-FR")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div
      className={`rounded border p-4 bg-white ${
        warn ? "border-amber-400 bg-amber-50" : "border-gray-200"
      }`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
