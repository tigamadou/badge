import { listCandidates } from "@/lib/print-requests/content";
import { loadRequest } from "@/lib/print-requests/service";
import { json, organizerRoute } from "@/lib/print-requests/route";

export const GET = organizerRoute({ allowArchived: true }, async (_req, { eventId, requestId }) => {
  await loadRequest(requestId, { eventId });
  return json({ candidates: await listCandidates(eventId, requestId) });
});
