import { prisma } from "@/lib/prisma";
import { OnsiteError } from "@/lib/print-requests/onsite";
import { loadOnsiteRequest } from "@/lib/print-requests/onsite-station";

/**
 * Contrôle d'appartenance du poste sur place d'organisation : la commande doit être une impression
 * sur place (hors brouillon) de CET évènement et de CETTE organisation. Tout écart répond 404
 * (jamais 403 ni 409), pour ne rien révéler d'une commande d'un autre évènement ou d'une autre organisation.
 * À appeler avant toute lecture d'inscription.
 */
export async function loadScopedOnsiteRequest(requestId: string, scope: { orgId: string; eventId: string }) {
  const found = await prisma.printRequest.findUnique({
    where: { id: requestId },
    select: { eventId: true, orgId: true, type: true, status: true, parentRequestId: true },
  });
  if (
    !found ||
    found.eventId !== scope.eventId ||
    found.orgId !== scope.orgId ||
    found.type !== "ONSITE" ||
    found.parentRequestId !== null ||
    found.status === "DRAFT"
  ) {
    throw new OnsiteError("NOT_FOUND", 404);
  }
  return loadOnsiteRequest(requestId);
}

/** Identifiant de commande lu dans les paramètres de route (le type de withEventAuth ne le connaît pas). */
export async function requestIdOf(params: Promise<unknown>): Promise<string> {
  return ((await params) as { requestId: string }).requestId;
}
