import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { loadOnsiteRequest, searchOnsiteRegistrations } from "@/lib/print-requests/onsite-station";
import { PrintRequestError } from "@/lib/print-requests/errors";
import { permissionDenied } from "@/app/api/platform/permission-response";
import { eventTargetOf } from "@/lib/permissions";
import { guarded, json } from "@/lib/print-requests/staff-api";

const querySchema = z.string().trim().min(2).max(100);

export const GET = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      const request = await loadOnsiteRequest(requestId);
      const denied = await permissionDenied(session.user.id, "print.onsite.operate", eventTargetOf(request));
      if (denied) return denied;
      const q = querySchema.safeParse(req.nextUrl.searchParams.get("q"));
      if (!q.success) throw new PrintRequestError("VALIDATION", 400);
      return json({ registrations: await searchOnsiteRegistrations(requestId, q.data) });
    }),
  { permission: "platform.access" },
);
