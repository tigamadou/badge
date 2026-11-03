import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { notifyPrintRequestStatusChanged } from "@/lib/notifications/triggers";
import { removeStaffLine, updateStaffLine } from "@/lib/print-requests/quote";
import { staffLinePatchSchema } from "@/lib/print-requests/inputs";
import { guarded, json, lineDTO, loadStaffRequest, parseBody } from "@/lib/print-requests/staff-api";

type Params = { requestId: string; lineId: string };

export const PATCH = withStaffAuth<Params>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId, lineId } = await params;
      const request = await loadStaffRequest(requestId);
      const patch = await parseBody(req, staffLinePatchSchema);
      const userId = session.user.id;
      const { line, revised } = await updateStaffLine({ requestId, lineId, userId, patch });
      await logActivity({
        type: "PRINT_REQUEST_UPDATED",
        userId,
        orgId: request.orgId,
        eventId: request.eventId,
        targetId: requestId,
        details: { op: "LINE_UPDATED", lineId },
        req,
      });
      if (revised) await notifyPrintRequestStatusChanged(requestId, userId, { organizer: true, staff: false });
      return json({ line: lineDTO(line) });
    }),
  { minRole: "STAFF_ADMIN" },
);

export const DELETE = withStaffAuth<Params>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId, lineId } = await params;
      const request = await loadStaffRequest(requestId);
      const userId = session.user.id;
      const { revised } = await removeStaffLine({ requestId, lineId, userId });
      await logActivity({
        type: "PRINT_REQUEST_UPDATED",
        userId,
        orgId: request.orgId,
        eventId: request.eventId,
        targetId: requestId,
        details: { op: "LINE_REMOVED", lineId },
        req,
      });
      if (revised) await notifyPrintRequestStatusChanged(requestId, userId, { organizer: true, staff: false });
      return json({ ok: true });
    }),
  { minRole: "STAFF_ADMIN" },
);
