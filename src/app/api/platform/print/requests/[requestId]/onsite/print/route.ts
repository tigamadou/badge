import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { loadOnsiteRequest, recordOnsitePrint } from "@/lib/print-requests/onsite-station";
import { guarded, json, parseBody } from "@/lib/print-requests/staff-api";

const bodySchema = z.object({ registrationId: z.string().min(1).max(100), confirmReprint: z.boolean().optional() });

export const POST = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      const { registrationId, confirmReprint } = await parseBody(req, bodySchema);
      const userId = session.user.id;
      const { orgId, eventId } = await loadOnsiteRequest(requestId);
      const { print, counter } = await recordOnsitePrint({
        requestId,
        registrationId,
        userId,
        confirmReprint: confirmReprint ?? false,
      });
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
  { minRole: "STAFF_SUPPORT" },
);
