import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOnsitePrintSettings } from "@/lib/settings";
import { OnsiteError } from "@/lib/print-requests/onsite";
import { OnsiteStation } from "@/components/staff/print/OnsiteStation";
import { loadScopedOnsiteRequest } from "@/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/onsite/_scope";
import { requireEventPagePermission } from "../../../_lib/page-access";

export const dynamic = "force-dynamic";

// Poste d'impression sur place de l'agent : même composant que le staff, branché sur les routes de l'évènement.
export default async function EventOnsiteStationPage({
  params,
}: {
  params: Promise<{ eventId: string; requestId: string }>;
}) {
  const { eventId, requestId } = await params;
  const list = `/event/${eventId}/print/onsite`;
  const { orgId, event } = await requireEventPagePermission(eventId, "print.onsite.operate", `${list}`);
  if (event.archived) redirect(list);

  let loaded;
  try {
    loaded = await loadScopedOnsiteRequest(requestId, { orgId, eventId });
  } catch (err) {
    if (err instanceof OnsiteError && err.code === "REQUEST_NOT_PRINTABLE") redirect(list);
    if (err instanceof OnsiteError) notFound();
    throw err;
  }
  const { request, counter } = loaded;
  const [eventRow, settings] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { title: true, location: true } }),
    getOnsitePrintSettings(),
  ]);

  return (
    <OnsiteStation
      requestId={requestId}
      reference={request.reference}
      orgId={orgId}
      eventId={eventId}
      eventTitle={eventRow?.title ?? ""}
      location={request.onsiteLocation ?? eventRow?.location ?? null}
      printerNote={settings.printerNote}
      initialCounter={counter}
      apiBase={`/api/org/${orgId}/events/${eventId}/print-requests/${requestId}`}
      backHref={list}
    />
  );
}
