import { z } from "zod";
import { withEventAuth } from "@/lib/with-event-auth";
import { searchOnsiteRegistrations } from "@/lib/print-requests/onsite-station";
import { PrintRequestError } from "@/lib/print-requests/errors";
import { guarded, json } from "@/lib/print-requests/staff-api";
import { loadScopedOnsiteRequest, requestIdOf } from "../_scope";

const querySchema = z.string().trim().min(2).max(100);

export const GET = withEventAuth(
  { permission: "print.onsite.operate", allowArchived: false },
  async (req, { orgId, eventId }, { params }) =>
    guarded(async () => {
      const requestId = await requestIdOf(params);
      await loadScopedOnsiteRequest(requestId, { orgId, eventId });
      const q = querySchema.safeParse(req.nextUrl.searchParams.get("q"));
      if (!q.success) throw new PrintRequestError("VALIDATION", 400);
      return json({ registrations: await searchOnsiteRegistrations(requestId, q.data) });
    }),
);
