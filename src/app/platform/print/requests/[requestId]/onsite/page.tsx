import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getOnsitePrintSettings } from "@/lib/settings";
import { loadUserContext } from "@/lib/user-context";
import { OnsiteError } from "@/lib/print-requests/onsite";
import { loadOnsiteRequest } from "@/lib/print-requests/onsite-station";
import { canOpenOnsiteStation } from "@/lib/print-requests/onsite-station-view";
import { OnsiteStation } from "@/components/staff/print/OnsiteStation";

export const dynamic = "force-dynamic";

export default async function OnsiteStationPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  if (!ctx || !ctx.isStaff || !ctx.staffRole) notFound();
  const detail = `/platform/print/requests/${requestId}`;
  // Le poste imprime : STAFF_SUPPORT au minimum, sinon retour à la fiche de la demande.
  if (!staffRoleAtLeast(ctx.staffRole, "STAFF_SUPPORT")) redirect(detail);

  let loaded;
  try {
    loaded = await loadOnsiteRequest(requestId);
  } catch (err) {
    // Demande introuvable ou qui n'est pas une impression sur place.
    if (err instanceof OnsiteError) notFound();
    throw err;
  }
  const { request, orgId, eventId, counter } = loaded;
  if (!canOpenOnsiteStation(request.status)) redirect(detail);

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
