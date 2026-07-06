import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Événements</h1>
        <Link href={`/admin/${orgId}/events/new`}>
          <Button>Nouvel événement</Button>
        </Link>
      </div>

      <table className="w-full bg-white border rounded text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="px-3 py-2">Titre</th>
            <th className="px-3 py-2">Slug</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Lieu</th>
            <th className="px-3 py-2">Inscriptions</th>
            <th className="px-3 py-2">Statut</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                Aucun événement. Créez votre premier événement.
              </td>
            </tr>
          )}
          {events.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="px-3 py-2 font-medium">
                <Link href={`/admin/${orgId}/events/${e.id}`} className="hover:underline">
                  {e.title}
                </Link>
              </td>
              <td className="px-3 py-2 text-slate-500">{e.slug}</td>
              <td className="px-3 py-2">{new Date(e.date).toLocaleDateString("fr-FR")}</td>
              <td className="px-3 py-2">{e.location}</td>
              <td className="px-3 py-2">{e._count.registrations}</td>
              <td className="px-3 py-2">
                {e.archived ? (
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-xs">Archivé</span>
                ) : e.registrationOpen ? (
                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs">
                    Inscriptions ouvertes
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs">
                    Fermé
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/admin/${orgId}/events/${e.id}/settings`}
                  className="text-green-600 hover:underline text-sm"
                >
                  Configurer
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
