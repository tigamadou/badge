import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasEventPermission } from "@/lib/auth-helpers";
import { loadUserContext } from "@/lib/user-context";
import { redirect } from "next/navigation";
import { BadgeBatchLoader } from "@/components/event/BadgeBatchLoader";
import { getEventOrgId } from "@/lib/event-org";
import { prisma } from "@/lib/prisma";

// La sélection n'est plus dans l'URL (limite de longueur, troncature) : `?sel=<clé>` désigne une
// liste d'identifiants rangée dans sessionStorage par la liste des badges. Le chargement des
// inscriptions approuvées se fait côté client par POST /badges/batch, sans plafond.
// Acces reserve a la permission `badge.print`.
export default async function BatchPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ sel?: string }>;
}) {
  const { eventId } = await params;
  const orgId = await getEventOrgId(eventId);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/event/${eventId}/badges/print`);
  }
  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");
  // Garde avant tout chargement : le layout de l'evenement laisse passer tout role.
  if (!hasEventPermission(ctx, eventId, orgId, "badge.print")) {
    redirect(`/event/${eventId}`);
  }

  const { sel } = await searchParams;
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { archived: true } });

  return <BadgeBatchLoader orgId={orgId} eventId={eventId} archived={event.archived} selectionKey={sel ?? null} />;
}
