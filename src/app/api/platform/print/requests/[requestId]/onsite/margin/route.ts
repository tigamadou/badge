import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { loadOnsiteRequest, setOnsiteMargin } from "@/lib/print-requests/onsite-station";
import { guarded, json, parseBody } from "@/lib/print-requests/staff-api";

const bodySchema = z.object({
  marginPercent: z.number().int().min(0).max(100),
  reason: z.string().trim().min(3).max(500),
});

export const PATCH = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      const { marginPercent, reason } = await parseBody(req, bodySchema);
      const userId = session.user.id;
      const { orgId, eventId, counter: before } = await loadOnsiteRequest(requestId);
      const counter = await setOnsiteMargin({ requestId, marginPercent, reason, userId });
      // La clé garde son nom historique, elle couvre la hausse comme la baisse.
      await logActivity({
        type: "PRINT_REQUEST_MARGIN_RAISED",
        userId,
        orgId,
        eventId,
        targetId: requestId,
        details: { from: before.marginPercent, to: marginPercent, reason },
        req,
      });
      return json({ counter });
    }),
  { minRole: "STAFF_ADMIN" },
);
