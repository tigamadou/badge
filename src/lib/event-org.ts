import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// v4 Bloc D : l'espace evenement est une route top-level `/event/[eventId]`, sans
// param `orgId` dans l'URL. Les pages qui construisent des URLs API scopees org
// (`/api/org/${orgId}/events/${eventId}/...`) ou qui appellent `hasEventPermission`
// resolvent l'orgId depuis l'evenement via ce helper.
export async function getEventOrgId(eventId: string): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event) notFound();
  return event.orgId;
}
