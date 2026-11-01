import { PrintRequestError } from "@/lib/print-requests/errors";
import { getOnsiteEligibility } from "@/lib/print-requests/onsite";
import { json, organizerRoute } from "@/lib/print-requests/route";

// Sert l'assistant de création : l'option « sur place » est désactivée si le template ne convient pas.
// Aucun template lisible : non éligible, sans erreur.
export const GET = organizerRoute({ allowArchived: true }, async (_req, { eventId }) => {
  try {
    return json(await getOnsiteEligibility(eventId));
  } catch (err) {
    if (err instanceof PrintRequestError && err.code === "VALIDATION") {
      return json({ eligible: false, templateId: null });
    }
    throw err;
  }
});
