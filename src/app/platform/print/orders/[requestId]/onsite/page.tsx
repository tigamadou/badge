import { notFound, redirect } from "next/navigation";
import { requirePlatformPage } from "@/app/platform/page-guard";
import { loadPermissions } from "@/lib/auth-guards";
import { eventTargetOf } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getOnsitePrintSettings } from "@/lib/settings";
import { OnsiteError } from "@/lib/print-requests/onsite";
import { loadOnsiteRequest } from "@/lib/print-requests/onsite-station";
import { OnsiteStation } from "@/components/staff/print/OnsiteStation";

export const dynamic = "force-dynamic";

export default async function OnsiteStationPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const detail = `/platform/print/orders/${requestId}`;
  const { userId } = await requirePlatformPage("platform.access", `${detail}/onsite`);

  let loaded;
  try {
    loaded = await loadOnsiteRequest(requestId);
  } catch (err) {
    // Statut qui n'ouvre pas le poste : retour à la fiche de la commande.
    if (err instanceof OnsiteError && err.code === "REQUEST_NOT_PRINTABLE") redirect(detail);
    // Commande introuvable, brouillon ou qui n'est pas une impression sur place.
    if (err instanceof OnsiteError) notFound();
    throw err;
  }
  const { request, orgId, eventId, counter } = loaded;
  // Le poste imprime : `print.onsite.operate` sur l'évènement, sinon retour à la fiche de la commande.
  if (!(await loadPermissions(userId, eventTargetOf({ eventId, orgId }))).has("print.onsite.operate")) redirect(detail);

  const [event, settings] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { title: true, location: true } }),
    getOnsitePrintSettings(),
  ]);

  return (
    <OnsiteStation
      requestId={requestId}
      reference={request.reference}
      orgId={orgId}
      eventId={eventId}
      eventTitle={event?.title ?? ""}
      location={request.onsiteLocation ?? event?.location ?? null}
      printerNote={settings.printerNote}
      initialCounter={counter}
    />
  );
}
