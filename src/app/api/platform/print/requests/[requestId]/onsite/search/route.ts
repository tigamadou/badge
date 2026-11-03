import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { searchOnsiteRegistrations } from "@/lib/print-requests/onsite-station";
import { PrintRequestError } from "@/lib/print-requests/errors";
import { guarded, json } from "@/lib/print-requests/staff-api";

const querySchema = z.string().trim().min(2).max(100);

export const GET = withStaffAuth<{ requestId: string }>(
  async (req, _ctx, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      const q = querySchema.safeParse(req.nextUrl.searchParams.get("q"));
      if (!q.success) throw new PrintRequestError("VALIDATION", 400);
      return json({ registrations: await searchOnsiteRegistrations(requestId, q.data) });
    }),
  { minRole: "STAFF_SUPPORT" },
);
