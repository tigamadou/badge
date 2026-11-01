import { z } from "zod";
import { setBadges } from "@/lib/print-requests/content";
import { badgeSelectionSchema } from "@/lib/print-requests/inputs";
import { loadRequest } from "@/lib/print-requests/service";
import { afterEdit, json, organizerRoute, parseBody } from "@/lib/print-requests/route";

const bodySchema = z.object({ selection: badgeSelectionSchema });

export const PUT = organizerRoute({ allowArchived: false }, async (req, ctx) => {
  const { selection } = await parseBody(req, bodySchema);
  const before = await loadRequest(ctx.requestId, { eventId: ctx.eventId });
  const { count, revised } = await setBadges({
    requestId: ctx.requestId,
    eventId: ctx.eventId,
    userId: ctx.session.user.id,
    selection,
  });
  await afterEdit(req, ctx, before.status, revised, "badges");
  return json({ count });
});
