import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { notifyPrintRequestStatusChanged } from "@/lib/notifications/triggers";
import { reopenQuote } from "@/lib/print-requests/quote";
import { guarded, json, loadStaffRequest, requestDTO } from "@/lib/print-requests/staff-api";

export const POST = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      await loadStaffRequest(requestId);
      const userId = session.user.id;
      const request = await reopenQuote({ requestId, userId });
      await logActivity({
        type: "PRINT_REQUEST_REOPENED",
        userId,
        orgId: request.orgId,
        eventId: request.eventId,
        targetId: requestId,
        req,
      });
      await notifyPrintRequestStatusChanged(requestId, userId, { organizer: true, staff: false });
      return json({ request: requestDTO(request) });
    }),
  { permission: "print.requests.reopen" },
);
