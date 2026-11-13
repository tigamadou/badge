import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { loadOnsiteRequest, lookupOnsiteRegistration } from "@/lib/print-requests/onsite-station";
import { permissionDenied } from "@/app/api/platform/permission-response";
import { eventTargetOf } from "@/lib/permissions";
import { guarded, json, parseBody } from "@/lib/print-requests/staff-api";

const bodySchema = z.object({ payload: z.string().min(1).max(200) });

export const POST = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      const request = await loadOnsiteRequest(requestId);
      const denied = await permissionDenied(session.user.id, "print.onsite.operate", eventTargetOf(request));
      if (denied) return denied;
      const { payload } = await parseBody(req, bodySchema);
      return json({ registration: await lookupOnsiteRegistration(requestId, payload) });
    }),
  { permission: "platform.access" },
);
