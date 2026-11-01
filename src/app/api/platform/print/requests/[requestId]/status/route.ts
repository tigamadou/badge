import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { notifyPrintRequestStatusChanged } from "@/lib/notifications/triggers";
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
      const { previousStatus, ...request } = await advanceStatus({ requestId, userId, to });
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
      return json({ request: requestDTO(request) });
    }),
  { minRole: "STAFF_SUPPORT" },
);
