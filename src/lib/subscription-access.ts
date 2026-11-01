import { prisma } from "@/lib/prisma";
import { resolveOrgLimits } from "@/lib/subscription";
import { parseRights, type OrgAccess } from "@/lib/subscription-rights";

// Lecture unique de l'accès d'une organisation : limites du plan + droits plateforme.
// Sans `react` (testable hors rendu) ; la mise en cache par requête est dans `org-access.ts`.
export async function loadOrgAccess(orgId: string): Promise<OrgAccess> {
  const [limits, settings] = await Promise.all([
    resolveOrgLimits(orgId),
    prisma.platformSettings.findUnique({
      where: { id: "singleton" },
      select: { subscriptionRights: true },
    }),
  ]);
  return {
    active: limits.active,
    maxEvents: limits.maxEvents,
    maxParticipantsPerEvent: limits.maxParticipantsPerEvent,
    rights: parseRights(settings?.subscriptionRights),
  };
}
