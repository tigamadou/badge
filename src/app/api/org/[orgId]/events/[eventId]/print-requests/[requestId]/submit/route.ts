import { logActivity } from "@/lib/activity-log";
import { submitRequest } from "@/lib/print-requests/lifecycle";
import { json, organizerRoute, toOrganizerDTO } from "@/lib/print-requests/route";

// Le déclencheur « demande envoyée » est appelé par submitRequest.
export const POST = organizerRoute({ allowArchived: false }, async (req, ctx) => {
  const request = await submitRequest({
    requestId: ctx.requestId,
    eventId: ctx.eventId,
    userId: ctx.session.user.id,
  });
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
