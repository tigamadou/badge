import { logActivity } from "@/lib/activity-log";
import { submitRequest } from "@/lib/print-requests/lifecycle";
import { json, organizerRoute, toOrganizerDTO } from "@/lib/print-requests/route";
import { EventImagesNoncompliantError, eventImagesErrorResponse } from "@/lib/event-image-compliance";

// Le déclencheur « commande envoyée » est appelé par submitRequest.
export const POST = organizerRoute({ allowArchived: false }, async (req, ctx) => {
  let request;
  try {
    request = await submitRequest({
      requestId: ctx.requestId,
      eventId: ctx.eventId,
      userId: ctx.session.user.id,
    });
  } catch (err) {
    // Avant le traducteur d'erreurs de organizerRoute, qui relancerait une erreur inconnue en 500.
    if (err instanceof EventImagesNoncompliantError) return eventImagesErrorResponse(err);
    throw err;
  }
  await logActivity({
    type: "PRINT_REQUEST_SUBMITTED",
    userId: ctx.session.user.id,
    orgId: ctx.orgId,
    eventId: ctx.eventId,
    targetId: request.id,
    details: { reference: request.reference },
    req,
  });
  return json({ request: toOrganizerDTO(request) });
});
