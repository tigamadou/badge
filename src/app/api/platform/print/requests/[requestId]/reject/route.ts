import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { notifyPrintRequestStatusChanged } from "@/lib/notifications/triggers";
import { rejectRequest } from "@/lib/print-requests/quote";
import { guarded, json, loadStaffRequest, parseBody, requestDTO } from "@/lib/print-requests/staff-api";

const bodySchema = z.object({ reason: z.string() });

export const POST = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      await loadStaffRequest(requestId);
      const { reason } = await parseBody(req, bodySchema);
      const userId = session.user.id;
      const request = await rejectRequest({ requestId, userId, reason });
      await logActivity({
        type: "PRINT_REQUEST_REJECTED",
        userId,
        orgId: request.orgId,
        eventId: request.eventId,
        targetId: requestId,
        details: { reason: reason.trim() },
        req,
      });
      await notifyPrintRequestStatusChanged(requestId, userId, { organizer: true, staff: false });
      return json({ request: requestDTO(request) });
    }),
  { permission: "print.requests.reject" },
);
