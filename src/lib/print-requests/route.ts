import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import type { PrintQuoteLine, PrintRequest, PrintRequestStatus } from "@prisma/client";
import { logActivity } from "@/lib/activity-log";
import { notifyPrintRequestStatusChanged } from "@/lib/notifications/triggers";
import { withEventAuth, type EventAuthCtx } from "@/lib/with-event-auth";
import { PrintRequestError } from "./errors";
import { onsiteOrPrintErrorResponse } from "./onsite";

// Le staff supervise depuis /platform : il lit les commandes mais n'agit jamais côté organisateur.
export function assertNotStaff(session: EventAuthCtx["session"]): void {
  if (session.user.isStaff) throw new PrintRequestError("STAFF_FORBIDDEN", 403);
}

// Corps JSON validé par un schéma zod ; tout écart donne 400 VALIDATION.
export async function parseBody<S extends z.ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new PrintRequestError("VALIDATION", 400);
  return parsed.data;
}

type RouteCtx = EventAuthCtx & { requestId: string };

// Route organisateur des commandes d'impression : permission `print.request`, refus du staff sur
// toute méthode qui écrit (C10), erreurs métier converties en réponses JSON françaises.
export function organizerRoute(
  options: { allowArchived: boolean },
  handler: (req: NextRequest, ctx: RouteCtx) => Promise<Response>,
) {
  return withEventAuth(
    { permission: "print.request", allowArchived: options.allowArchived },
    async (req, ctx, extra) => {
      try {
        if (req.method.toUpperCase() !== "GET") assertNotStaff(ctx.session);
        const params = (await extra.params) as { requestId?: string };
        return await handler(req, { ...ctx, requestId: params.requestId ?? "" });
      } catch (err) {
        return onsiteOrPrintErrorResponse(err);
      }
    },
  );
}

export const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status });

// Suites d'une modification organisateur : journal hors brouillon (le staff n'a rien vu d'un
// brouillon) ; si le devis a été révisé, le staff en est prévenu.
export async function afterEdit(
  req: NextRequest,
  ctx: RouteCtx,
  before: PrintRequestStatus,
  revised: boolean,
  changed: string,
): Promise<void> {
  if (before === "DRAFT") return;
  await logActivity({
    type: "PRINT_REQUEST_UPDATED",
    userId: ctx.session.user.id,
    orgId: ctx.orgId,
    eventId: ctx.eventId,
    targetId: ctx.requestId,
    details: { changed, revised },
    req,
  });
  if (revised) {
    await notifyPrintRequestStatusChanged(ctx.requestId, ctx.session.user.id, { organizer: false, staff: true });
  }
}

// Liste blanche des champs d'une commande exposés à l'organisateur (rien de interne : créateur,
// accepteur, paiement, marge, commande parente, verrou de template).
export function toOrganizerDTO(r: PrintRequest) {
  return {
    id: r.id,
    reference: r.reference,
    eventId: r.eventId,
    type: r.type,
    status: r.status,
    badgeWidthPx: r.badgeWidthPx,
    badgeHeightPx: r.badgeHeightPx,
    badgePages: r.badgePages,
    delivery: r.delivery,
    deliveryAddress: r.deliveryAddress,
    deliveryContactName: r.deliveryContactName,
    deliveryContactPhone: r.deliveryContactPhone,
    wantedBy: r.wantedBy,
    estimatedQuantity: r.estimatedQuantity,
    onsiteSchedule: r.onsiteSchedule,
    onsiteLocation: r.onsiteLocation,
    onsiteContactName: r.onsiteContactName,
    onsiteContactPhone: r.onsiteContactPhone,
    notes: r.notes,
    quoteVersion: r.quoteVersion,
    acceptedVersion: r.acceptedVersion,
    acceptedTotal: r.acceptedTotal,
    acceptedAt: r.acceptedAt,
    total: r.total,
    submittedAt: r.submittedAt,
    quotedAt: r.quotedAt,
    paidAt: r.paidAt,
    completedAt: r.completedAt,
    cancelledAt: r.cancelledAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function toLineDTO(l: PrintQuoteLine) {
  return {
    id: l.id,
    kind: l.kind,
    productId: l.productId,
    label: l.label,
    optionsSnapshot: l.optionsSnapshot,
    choices: l.choices,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    lineTotal: l.lineTotal,
    position: l.position,
    addedBy: l.addedBy,
    priceOverridden: l.priceOverridden,
    quantityOverridden: l.quantityOverridden,
  };
}
