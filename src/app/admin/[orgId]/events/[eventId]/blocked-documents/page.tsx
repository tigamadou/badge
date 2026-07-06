import { redirect } from "next/navigation";

// Fusion v2-16 : les documents bloqués vivent désormais dans l'onglet « Documents »
// de l'écran unifié des listes de blocage (hôte = blocked-emails).
export default async function BlockedDocumentsPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  redirect(`/admin/${orgId}/events/${eventId}/blocked-emails`);
}
