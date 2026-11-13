import { z } from "zod";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { recordOnsitePrint } from "@/lib/print-requests/onsite-station";
import { guarded, json, parseBody } from "@/lib/print-requests/staff-api";
import { EventImagesNoncompliantError, eventImagesErrorResponse } from "@/lib/event-image-compliance";
import { loadScopedOnsiteRequest, requestIdOf } from "../_scope";

const bodySchema = z.object({ registrationId: z.string().min(1).max(100), confirmReprint: z.boolean().optional() });

export const POST = withEventAuth(
  { permission: "print.onsite.operate", allowArchived: false },
  async (req, { orgId, eventId, session }, { params }) =>
    guarded(async () => {
      const requestId = await requestIdOf(params);
      const { registrationId, confirmReprint } = await parseBody(req, bodySchema);
      const userId = session.user.id;
      await loadScopedOnsiteRequest(requestId, { orgId, eventId });
      let recorded;
      try {
        recorded = await recordOnsitePrint({
          requestId,
          registrationId,
          userId,
          confirmReprint: confirmReprint ?? false,
        });
      } catch (err) {
        // Avant le traducteur d'erreurs de guarded, qui relancerait une erreur inconnue en 500.
        if (err instanceof EventImagesNoncompliantError) return eventImagesErrorResponse(err);
        throw err;
      }
      const { print, counter } = recorded;
      try {
        await logActivity({
          type: "BADGE_PRINTED",
          userId,
          orgId,
          eventId,
          targetId: registrationId,
          details: { printRequestId: requestId, onsite: true, reprint: print.reprint },
          req,
        });
      } catch (e) {
        // L'impression est enregistrée : l'échec du journal ne doit pas la transformer en erreur.
        console.error("[activity] BADGE_PRINTED log failed", e);
      }
      return json({ print, counter, pdfUrl: `/api/org/${orgId}/events/${eventId}/badges/${registrationId}` }, 201);
    }),
);
