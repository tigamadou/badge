import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { loadOnsiteOverview, setOnsiteMargin } from "@/lib/print-requests/onsite-station";
import { guarded, json, parseBody } from "@/lib/print-requests/staff-api";

const bodySchema = z.object({
  marginPercent: z.number().int().min(0).max(100),
  reason: z.string().trim().min(3).max(500),
});

export const PATCH = withStaffAuth<{ requestId: string }>(
  async (req, { session }, { params }) =>
    guarded(async () => {
      const { requestId } = await params;
      const { marginPercent, reason } = await parseBody(req, bodySchema);
      const userId = session.user.id;
      const { orgId, eventId } = await loadOnsiteOverview(requestId);
      // `from` est lu sous verrou (marge nulle en base -> from: 0).
      const { counter, from } = await setOnsiteMargin({ requestId, marginPercent, reason, userId });
      // Même marge : aucun changement, donc aucun journal.
      if (from === marginPercent) return json({ counter });
      // La clé garde son nom historique, elle couvre la hausse comme la baisse.
      try {
        await logActivity({
          type: "PRINT_REQUEST_MARGIN_RAISED",
          userId,
          orgId,
          eventId,
          targetId: requestId,
          details: { from, to: marginPercent, reason },
          req,
        });
      } catch (e) {
        // Le réglage est validé : l'échec du journal ne doit pas le transformer en erreur.
        console.error("[activity] PRINT_REQUEST_MARGIN_RAISED log failed", e);
      }
      return json({ counter });
    }),
  { minRole: "STAFF_ADMIN" },
);
