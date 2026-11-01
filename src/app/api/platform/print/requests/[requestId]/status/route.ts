import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { notifyPrintRequestQuoted, notifyPrintRequestStatusChanged } from "@/lib/notifications/triggers";
import { advanceStatus } from "@/lib/print-requests/quote";
import { guarded, json, loadStaffRequest, parseBody, requestDTO } from "@/lib/print-requests/staff-api";

const bodySchema = z.object({ to: z.enum(["IN_PRODUCTION", "READY", "COMPLETED"]) });

export const POST = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      await loadStaffRequest(requestId);
      const { to } = await parseBody(req, bodySchema);
      const userId = session.user.id;
      const { previousStatus, closure, ...request } = await advanceStatus({ requestId, userId, to });
      await logActivity({
        type: "PRINT_REQUEST_STATUS_CHANGED",
        userId,
        orgId: request.orgId,
        eventId: request.eventId,
        targetId: requestId,
        details: { from: previousStatus, to },
        req,
      });
      await notifyPrintRequestStatusChanged(requestId, userId, { organizer: true, staff: false });
      // La clôture d'une demande sur place a eu lieu dans la transaction : on journalise et on
      // notifie ici, après elle (un échec de notification ne doit pas la défaire).
      if (closure?.outcome === "CREDIT") {
        await logActivity({
          type: "PRINT_CREDIT_EARNED",
          userId,
          orgId: request.orgId,
          eventId: request.eventId,
          targetId: requestId,
          details: { amount: closure.amount, unusedBadges: closure.unusedBadges },
          req,
        });
      }
      if (closure?.outcome === "SUPPLEMENT") {
        await logActivity({
          type: "PRINT_REQUEST_SUPPLEMENT_CREATED",
          userId,
          orgId: request.orgId,
          eventId: request.eventId,
          targetId: closure.supplementRequestId,
          details: { parentRequestId: requestId, extraBadges: closure.extraBadges, total: closure.total },
          req,
        });
        await notifyPrintRequestQuoted(closure.supplementRequestId, userId);
      }
      return json({ request: requestDTO(request), closure });
    }),
  { minRole: "STAFF_SUPPORT" },
);
