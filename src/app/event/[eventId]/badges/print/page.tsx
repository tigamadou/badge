import { BadgeBatchLoader } from "@/components/event/BadgeBatchLoader";
import { requireEventPagePermission } from "../../_lib/page-access";
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
  const { orgId } = await requireEventPagePermission(eventId, "badge.print", `/event/${eventId}/badges/print`);

  const { sel } = await searchParams;
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { archived: true } });

  return <BadgeBatchLoader orgId={orgId} eventId={eventId} archived={event.archived} selectionKey={sel ?? null} />;
}
