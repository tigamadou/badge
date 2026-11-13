import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { notifyPrintRequestStatusChanged } from "@/lib/notifications/triggers";
import { addStaffLine } from "@/lib/print-requests/quote";
import { staffLineSchema } from "@/lib/print-requests/inputs";
import { guarded, json, lineDTO, loadStaffRequest, parseBody } from "@/lib/print-requests/staff-api";

export const POST = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      const request = await loadStaffRequest(requestId);
      const input = await parseBody(req, staffLineSchema);
      const userId = session.user.id;
      const { line, revised } = await addStaffLine({ requestId, userId, line: input });
      await logActivity({
        type: "PRINT_REQUEST_UPDATED",
        userId,
        orgId: request.orgId,
        eventId: request.eventId,
        targetId: requestId,
        details: { op: "LINE_ADDED", lineId: line.id },
        req,
      });
      if (revised) await notifyPrintRequestStatusChanged(requestId, userId, { organizer: true, staff: false });
      return json({ line: lineDTO(line) }, 201);
    }),
  { permission: "print.requests.quote.edit" },
);
