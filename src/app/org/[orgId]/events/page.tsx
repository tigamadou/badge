import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/ui/Icon";

export default async function EventsListPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const events = await prisma.event.findMany({
    where: { orgId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      date: true,
      location: true,
      registrationOpen: true,
      archived: true,
      _count: { select: { registrations: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Événements</h1>
          <p className="mt-0.5 text-sm text-slate-400">Les événements de votre organisation</p>
        </div>
        <Link
          href={`/org/${orgId}/events/new`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          <Icon name="plus" size={16} /> Créer un événement
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Titre</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Lieu</th>
              <th className="px-4 py-3">Inscriptions</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  Aucun événement. Créez votre premier événement.
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr
                key={e.id}
                className={`border-t border-slate-100 hover:bg-slate-50 ${e.archived ? "opacity-60" : ""}`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/org/${orgId}/events/${e.id}`}
                    className="text-sm font-medium text-slate-900 hover:text-green-600"
                  >
                    {e.title}
                  </Link>
                  <div className="font-mono text-xs text-slate-400">{e.slug}</div>
                </td>
                <td className="px-4 py-3 text-sm tabular-nums text-slate-600">
                  {new Date(e.date).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{e.location}</td>
                <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{e._count.registrations}</td>
                <td className="px-4 py-3">
                  {e.archived ? (
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      Archivé
                    </span>
                  ) : e.registrationOpen ? (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      Inscriptions ouvertes
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      Fermées
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/org/${orgId}/events/${e.id}/settings`}
                    className="text-[13px] font-medium text-green-600 hover:underline"
                  >
                    Configurer
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
