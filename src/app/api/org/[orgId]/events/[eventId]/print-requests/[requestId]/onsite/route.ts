import { withEventAuth } from "@/lib/with-event-auth";
import { getOnsitePrintSettings } from "@/lib/settings";
import { guarded, json } from "@/lib/print-requests/staff-api";
import { loadScopedOnsiteRequest, requestIdOf } from "./_scope";

// Données du poste d'impression sur place pour l'agent d'organisation : aucun prix, aucune ligne de devis, aucun total.
export const GET = withEventAuth(
  { permission: "print.onsite.operate", allowArchived: false },
  async (_req, { orgId, eventId }, { params }) =>
    guarded(async () => {
      const requestId = await requestIdOf(params);
      const { request, counter } = await loadScopedOnsiteRequest(requestId, { orgId, eventId });
      const settings = await getOnsitePrintSettings();
      return json({
        request: {
          id: request.id,
          reference: request.reference,
          status: request.status,
          onsiteLocation: request.onsiteLocation,
          onsiteSchedule: request.onsiteSchedule,
        },
        counter,
        printerNote: settings.printerNote,
      });
    }),
);
