import { listCandidates } from "@/lib/print-requests/content";
import { listPrintItemsPage } from "@/lib/print-items-page";
import { loadRequest } from "@/lib/print-requests/service";
import { json, organizerRoute } from "@/lib/print-requests/route";

export const GET = organizerRoute({ allowArchived: true }, async (req, { eventId, requestId }) => {
  await loadRequest(requestId, { eventId });
  const params = req.nextUrl.searchParams;
  if (params.get("scope") === "items") return json(await listPrintItemsPage(requestId, params));
  return json({ candidates: await listCandidates(eventId, requestId) });
});
