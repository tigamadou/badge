import { redirect } from "next/navigation";
import { requireEventPagePermission } from "../_lib/page-access";

// Fusion v2-16 : les documents bloqués vivent désormais dans l'onglet « Documents »
// de l'écran unifié des listes de blocage (hôte = blocked-emails).
export default async function BlockedDocumentsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  await requireEventPagePermission(eventId, "registration.block", `/event/${eventId}/blocked-documents`);
  redirect(`/event/${eventId}/blocked-emails`);
}
