import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import { notifyPrintRequestStatusChanged } from "@/lib/notifications/triggers";
import { acceptQuote } from "@/lib/print-requests/lifecycle";
import { json, organizerRoute, parseBody, toOrganizerDTO } from "@/lib/print-requests/route";

const bodySchema = z.object({ version: z.number().int().min(0) });

// acceptQuote prévient déjà le staff ; la route ne notifie que l'organisateur.
// Le refus du staff (STAFF_FORBIDDEN) précède toute lecture ; le propriétaire est vérifié par acceptQuote.
export const POST = organizerRoute({ allowArchived: true }, async (req, ctx) => {
  const { version } = await parseBody(req, bodySchema);
  const request = await acceptQuote({
    requestId: ctx.requestId,
    eventId: ctx.eventId,
    userId: ctx.session.user.id,
    version,
  });
  await logActivity({
    type: "PRINT_REQUEST_ACCEPTED",
    userId: ctx.session.user.id,
    orgId: ctx.orgId,
    eventId: ctx.eventId,
    targetId: request.id,
    details: { reference: request.reference, version, total: request.total },
    req,
  });
  // Devis couvert par le crédit : acceptQuote a déjà notifié le paiement (organisateur compris).
  if (request.status !== "PAID") {
    await notifyPrintRequestStatusChanged(request.id, ctx.session.user.id, { organizer: true, staff: false });
  }
  return json({ request: toOrganizerDTO(request) });
});
