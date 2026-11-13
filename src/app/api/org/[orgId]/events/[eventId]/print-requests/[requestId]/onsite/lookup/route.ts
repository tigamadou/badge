import { z } from "zod";
import { withEventAuth } from "@/lib/with-event-auth";
import { lookupOnsiteRegistration } from "@/lib/print-requests/onsite-station";
import { guarded, json, parseBody } from "@/lib/print-requests/staff-api";
import { loadScopedOnsiteRequest, requestIdOf } from "../_scope";

const bodySchema = z.object({ payload: z.string().min(1).max(200) });

export const POST = withEventAuth(
  { permission: "print.onsite.operate", allowArchived: false },
  async (req, { orgId, eventId }, { params }) =>
    guarded(async () => {
      const requestId = await requestIdOf(params);
      const { payload } = await parseBody(req, bodySchema);
      await loadScopedOnsiteRequest(requestId, { orgId, eventId });
      return json({ registration: await lookupOnsiteRegistration(requestId, payload) });
    }),
);
