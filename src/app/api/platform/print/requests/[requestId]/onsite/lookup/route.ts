import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { lookupOnsiteRegistration } from "@/lib/print-requests/onsite-station";
import { guarded, json, parseBody } from "@/lib/print-requests/staff-api";

const bodySchema = z.object({ payload: z.string().min(1).max(2000) });

export const POST = withStaffAuth<{ requestId: string }>(
  async (req, _ctx, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      const { payload } = await parseBody(req, bodySchema);
      return json({ registration: await lookupOnsiteRegistration(requestId, payload) });
    }),
  { minRole: "STAFF_SUPPORT" },
);
