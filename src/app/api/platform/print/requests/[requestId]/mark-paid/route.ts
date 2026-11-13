import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { notifyPrintRequestPaid } from "@/lib/notifications/triggers";
import { markPaidManually } from "@/lib/print-requests/quote";
import { guarded, json, loadStaffRequest, parseBody, requestDTO } from "@/lib/print-requests/staff-api";

const bodySchema = z.object({ reason: z.string().trim().min(3).max(500) });

export const POST = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      await loadStaffRequest(requestId);
      const { reason } = await parseBody(req, bodySchema);
      const userId = session.user.id;
      const request = await markPaidManually({ requestId, userId, reason });
      // Le paiement est deja enregistre : un echec du journal ne doit ni changer la reponse ni supprimer la notification.
      try {
        await logActivity({
          type: "PRINT_REQUEST_MARKED_PAID",
          userId,
          orgId: request.orgId,
          eventId: request.eventId,
          targetId: requestId,
          details: { reason },
          req,
        });
      } catch (error) {
        console.error("[mark-paid] journal en echec", error);
      }
      await notifyPrintRequestPaid(requestId, userId, { manual: true });
      return json({ request: requestDTO(request) });
    }),
  { permission: "print.requests.mark_paid" },
);
