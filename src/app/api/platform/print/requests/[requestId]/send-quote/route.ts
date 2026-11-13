import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { notifyPrintRequestQuoted } from "@/lib/notifications/triggers";
import { sendQuote } from "@/lib/print-requests/quote";
import { guarded, json, loadStaffRequest, requestDTO } from "@/lib/print-requests/staff-api";

export const POST = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      await loadStaffRequest(requestId);
      const userId = session.user.id;
      const request = await sendQuote({ requestId, userId });
      await logActivity({
        type: "PRINT_REQUEST_QUOTED",
        userId,
        orgId: request.orgId,
        eventId: request.eventId,
        targetId: requestId,
        details: { version: request.quoteVersion, total: request.total },
        req,
      });
      await notifyPrintRequestQuoted(requestId, userId);
      return json({ request: requestDTO(request) });
    }),
  { permission: "print.requests.quote.send" },
);
