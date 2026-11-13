import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { loadOnsiteRequest, recordOnsitePrint } from "@/lib/print-requests/onsite-station";
import { permissionDenied } from "@/app/api/platform/permission-response";
import { eventTargetOf } from "@/lib/permissions";
import { guarded, json, parseBody } from "@/lib/print-requests/staff-api";
import { EventImagesNoncompliantError, eventImagesErrorResponse } from "@/lib/event-image-compliance";

const bodySchema = z.object({ registrationId: z.string().min(1).max(100), confirmReprint: z.boolean().optional() });

export const POST = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      const userId = session.user.id;
      const request = await loadOnsiteRequest(requestId);
      const denied = await permissionDenied(userId, "print.onsite.operate", eventTargetOf(request));
      if (denied) return denied;
      const { registrationId, confirmReprint } = await parseBody(req, bodySchema);
      const { orgId, eventId } = request;
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
  { permission: "platform.access" },
);
