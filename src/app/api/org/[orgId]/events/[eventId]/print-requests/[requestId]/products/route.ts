import { z } from "zod";
import { setOrganizerProducts } from "@/lib/print-requests/content";
import { organizerProductsSchema } from "@/lib/print-requests/inputs";
import { loadRequest } from "@/lib/print-requests/service";
import { afterEdit, json, organizerRoute, parseBody } from "@/lib/print-requests/route";

const bodySchema = z.object({ products: organizerProductsSchema });

export const PUT = organizerRoute({ allowArchived: false }, async (req, ctx) => {
  const { products } = await parseBody(req, bodySchema);
  const before = await loadRequest(ctx.requestId, { eventId: ctx.eventId });
  const { lines, total, revised } = await setOrganizerProducts({
    requestId: ctx.requestId,
    eventId: ctx.eventId,
    userId: ctx.session.user.id,
    products,
  });
  await afterEdit(req, ctx, before.status, revised, "products");
  return json({ lines, total });
});
