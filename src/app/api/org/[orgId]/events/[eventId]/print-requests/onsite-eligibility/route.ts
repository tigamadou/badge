import { getOnsiteEligibility } from "@/lib/print-requests/onsite";
import { json, organizerRoute } from "@/lib/print-requests/route";

// Sert l'assistant de création : l'option « sur place » est désactivée si le template ne convient pas.
export const GET = organizerRoute({ allowArchived: true }, async (_req, { eventId }) =>
  json(await getOnsiteEligibility(eventId)),
);
