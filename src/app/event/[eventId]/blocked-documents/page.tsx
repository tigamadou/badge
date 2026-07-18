import { redirect } from "next/navigation";
import { getEventOrgId } from "@/lib/event-org";

// Fusion v2-16 : les documents bloqués vivent désormais dans l'onglet « Documents »
// de l'écran unifié des listes de blocage (hôte = blocked-emails).
export default async function BlockedDocumentsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const orgId = await getEventOrgId(eventId);
  redirect(`/event/${eventId}/blocked-emails`);
}
