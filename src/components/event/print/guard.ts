import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, eventTargetOf } from "@/lib/permissions";
import { loadUserContext } from "@/lib/user-context";

// Garde commune des pages « Impression » : session, évènement, permission `print.request`.
// Sans la permission : retour au tableau de bord de l'évènement.
export async function requirePrintAccess(eventId: string, path: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=/event/${eventId}${path}`);
  const ctx = await loadUserContext(session.user.id);
  if (!ctx) redirect("/login");
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, orgId: true, archived: true },
  });
  if (!event) notFound();
  if (!hasPermission(ctx, "print.request", eventTargetOf({ eventId, orgId: event.orgId }))) redirect(`/event/${eventId}`);
  return { ctx, event, orgId: event.orgId };
}
