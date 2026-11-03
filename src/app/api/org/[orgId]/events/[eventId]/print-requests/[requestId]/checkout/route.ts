import { PaymentError, startPrintRequestCheckout } from "@/lib/payments";
import { json, organizerRoute } from "@/lib/print-requests/route";
import { assertOwner } from "@/lib/print-requests/service";

// Paiement d'un devis accepté : réservé à l'OWNER de l'organisation. Le staff est refusé (403
// STAFF_FORBIDDEN) par organizerRoute avant toute lecture ; un devis accepté reste payable si
// l'évènement est archivé.
export const POST = organizerRoute({ allowArchived: true }, async (req, ctx) => {
  await assertOwner(ctx.session.user.id, ctx.orgId);
  try {
    const { url } = await startPrintRequestCheckout({
      orgId: ctx.orgId,
      eventId: ctx.eventId,
      requestId: ctx.requestId,
      userId: ctx.session.user.id,
      req,
    });
    return json({ url });
  } catch (err) {
    if (err instanceof PaymentError) return json({ error: err.code }, err.httpStatus);
    throw err;
  }
});
