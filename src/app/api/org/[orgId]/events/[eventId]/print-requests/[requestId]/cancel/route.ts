import { logActivity } from "@/lib/activity-log";
import { cancelRequest } from "@/lib/print-requests/lifecycle";
import { json, organizerRoute } from "@/lib/print-requests/route";

// Le statut est notifié au staff par cancelRequest quand la demande n'était pas un brouillon.
export const POST = organizerRoute({ allowArchived: true }, async (req, ctx) => {
  const { request, from } = await cancelRequest({
    requestId: ctx.requestId,
    eventId: ctx.eventId,
    userId: ctx.session.user.id,
  });
  await logActivity({
    type: "PRINT_REQUEST_CANCELLED",
    userId: ctx.session.user.id,
    orgId: ctx.orgId,
    eventId: ctx.eventId,
    targetId: request.id,
    details: { reference: request.reference, from },
    req,
  });
  return json({ request });
});
