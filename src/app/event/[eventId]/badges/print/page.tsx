import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasEventPermission } from "@/lib/auth-helpers";
import { loadUserContext } from "@/lib/user-context";
import { redirect } from "next/navigation";
import { BadgeBatchPanel, type BatchBadge } from "@/components/event/BadgeBatchPanel";
import { getEventOrgId } from "@/lib/event-org";
import { prisma } from "@/lib/prisma";
import { parseBadgeIds } from "@/lib/badge-batch";

// Les inscriptions sont lues ici (plus d'appels client a /registrations/[id], reserves
// a OPERATOR). Seules les inscriptions approuvees de l'evenement sont retenues, dans
// l'ordre de la selection ; les autres identifiants sont comptes comme ignores.
// Acces reserve a la permission `badge.print`.

// Plafond des ids lus : meme limite que la route de marquage registrations/print (zod .max(500)).
const MAX_IDS_READ = 500;

export default async function BatchPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ ids?: string }>;
}) {
  const { eventId } = await params;
  const orgId = await getEventOrgId(eventId);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/event/${eventId}/badges/print`);
  }
  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");
  // Garde avant toute lecture d'inscription : le layout de l'evenement laisse passer tout role.
  if (!hasEventPermission(ctx, eventId, orgId, "badge.print")) {
    redirect(`/event/${eventId}`);
  }

  const { ids: idsParam } = await searchParams;
  const ids = parseBadgeIds(idsParam ?? null).slice(0, MAX_IDS_READ);

  const [event, registrations] = await Promise.all([
    prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { archived: true } }),
    prisma.registration.findMany({
      where: { id: { in: ids }, eventId, status: "APPROVED" },
      include: { category: true },
    }),
  ]);
  const byId = new Map(registrations.map((r) => [r.id, r]));
  const badges: BatchBadge[] = ids.flatMap((id) => {
    const r = byId.get(id);
    if (!r) return [];
    return [
      {
        id: r.id,
        label: r.category.anonymous ? "Identité masquée" : `${r.snapshotFirstName} ${r.snapshotLastName}`,
        categoryName: r.category.name,
        categoryColor: r.category.neutralBadge ? "#334155" : r.category.color,
        printed: r.badgePrinted,
      },
    ];
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Impression par lot</h1>
        <p className="mt-0.5 text-sm text-slate-400">{badges.length} badge(s) à imprimer</p>
      </div>
      <BadgeBatchPanel
        orgId={orgId}
        eventId={eventId}
        archived={event.archived}
        badges={badges}
        ignored={ids.length - badges.length}
      />
    </div>
  );
}
