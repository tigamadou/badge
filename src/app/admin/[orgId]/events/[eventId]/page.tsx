import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUserContext } from "@/lib/user-context";
import { effectiveEventRole } from "@/lib/auth-helpers";
import { countCountableRegistrations } from "@/lib/event-quota";

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
      <div className="space-y-6 max-w-xl">
        <h1 className="text-2xl font-bold">Tableau de bord opérateur</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Kpi label="Mes scans" value={myScans} />
          <Link
            href={`/admin/${orgId}/events/${eventId}/scan`}
            className="rounded border bg-white p-4 hover:bg-gray-50 flex items-center justify-center text-lg font-semibold"
          >
            Ouvrir le scanner
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
        select: { id: true, firstName: true, lastName: true, email: true, status: true, createdAt: true },
      }),
      countCountableRegistrations(eventId),
    ]);

  const quotaMax = event.organization.quotaMaxRegistrations;
  const quotaPct = quotaMax != null ? Math.round((quota30d / quotaMax) * 100) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{event.title} — Tableau de bord</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="En attente" value={pending} />
        <Kpi label="Approuvées" value={approved} />
        <Kpi label="Rejetées" value={rejected} />
        <Kpi label="Badges imprimés" value={badgesPrinted} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Scans aujourd&apos;hui" value={scansToday} />
        <Kpi label="Scans total" value={scansTotal} />
        <Kpi
          label="Quota inscriptions"
          value={quotaMax != null ? `${quota30d}/${quotaMax}` : "—"}
          warn={quotaPct != null && quotaPct > 80}
        />
      </div>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Dernières inscriptions</h2>
          <Link href={`/admin/${orgId}/events/${eventId}/registrations`} className="text-sm text-blue-600 hover:underline">
            Tout voir
          </Link>
        </div>
        <ul className="bg-white border rounded divide-y">
          {latest.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">Aucune inscription pour le moment.</li>
          )}
          {latest.map((r) => (
            <li key={r.id} className="px-4 py-3 flex justify-between text-sm">
              <Link href={`/admin/${orgId}/events/${eventId}/registrations/${r.id}`} className="hover:underline">
                {r.firstName} {r.lastName} <span className="text-gray-400">— {r.email}</span>
              </Link>
              <span className="text-xs text-gray-500">
                {r.status} — {new Date(r.createdAt).toLocaleDateString("fr-FR")}
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
      className={`rounded border p-4 bg-white ${warn ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
