import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/ui/Icon";
import { PrintRequestStatusBadge } from "@/components/print/PrintRequestStatusBadge";
import { OnsiteTemplateAlert } from "@/components/print/OnsiteTemplateAlert";
import { onsiteTemplateStatus } from "@/lib/print-requests/onsite";
import { OnsiteCounterCard } from "@/components/print/OnsiteCounterCard";
import { loadOnsiteOverview } from "@/lib/print-requests/onsite-station";
import { showsOnsiteCounter } from "@/lib/print-requests/onsite-station-view";
import { listThread } from "@/lib/print-requests/thread";
import { markRead } from "@/lib/print-requests/read-state";
import { OrganizerConversation } from "@/components/event/print/order/OrganizerConversation";
import { OrganizerOrderSummary } from "@/components/event/print/order/OrganizerOrderSummary";
import { OrganizerQuoteColumn } from "@/components/event/print/order/OrganizerQuoteColumn";
import { requirePrintAccess } from "@/components/event/print/guard";
import { requestBadgeCount } from "@/lib/print-requests/service";
import { hasPendingPayment } from "@/components/event/print/pay-button";
import { RelatedRequestLinks } from "@/components/print/RelatedRequestLinks";
import { creditOfferSentence, showsCreditOffer } from "@/lib/print-requests/credit-view";
import { getAvailableOrgPrintCredit } from "@/lib/print-requests/org-credit";
import { Alert } from "@/components/ui/Feedback";
import { PAYMENT_HISTORY_SELECT, toPaymentHistoryItem } from "@/lib/payment-history";

export const dynamic = "force-dynamic";

export default async function PrintRequestDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; requestId: string }>;
}) {
  const { eventId, requestId } = await params;
  const { event, orgId, ctx } = await requirePrintAccess(eventId, `/print/${requestId}`);
  const request = await prisma.printRequest.findFirst({
    where: { id: requestId, eventId },
    include: {
      parentRequest: { select: { id: true, reference: true } },
      childRequests: { select: { id: true, reference: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!request) notFound();
  // Crédit encore libre pour cette commande (hors sa propre réservation) : proposé tant qu'elle est ouverte.
  const availableCredit = await getAvailableOrgPrintCredit(orgId, requestId);

  const [lines, badgeCount, owner, paymentRows] = await Promise.all([
    prisma.printQuoteLine.findMany({
      where: { requestId, removedAt: null },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
    requestBadgeCount(prisma, request),
    prisma.orgMembership.findFirst({
      where: { userId: ctx.user.id, orgId, role: "OWNER" },
      select: { userId: true },
    }),
    prisma.payment.findMany({
      where: { printRequestId: requestId },
      orderBy: { createdAt: "desc" },
      select: PAYMENT_HISTORY_SELECT,
    }),
  ]);
  const payments = paymentRows.map(toPaymentHistoryItem);
  const onsiteTemplate = await onsiteTemplateStatus(request);
  // Compteur de l'impression sur place (commande principale, à partir du paiement).
  const onsiteCounter =
    request.type === "ONSITE" && request.parentRequestId === null && showsOnsiteCounter(request.status)
      ? (await loadOnsiteOverview(requestId)).counter
      : null;
  const isOwner = !ctx.isStaff && owner !== null;
  const canAccept = isOwner && request.status === "QUOTED";
  const base = `/api/org/${orgId}/events/${eventId}/print-requests`;
  // Capturé avant la lecture : un message arrivé pendant le rendu restera non lu.
  const readAt = new Date();
  const entries = await listThread(requestId, "ORGANIZER");
  // Le staff en consultation ne doit pas effacer ses propres non-lus.
  if (!ctx.isStaff) await markRead(requestId, ctx.user.id, readAt);

  return (
    <div className="space-y-4">
      <Link
        href={`/event/${eventId}/print`}
        className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
      >
        <Icon name="arrow-left" size={14} /> Impression
      </Link>

      <h1 className="text-xl font-semibold text-slate-900">Commande d&apos;impression {request.reference}</h1>

      <RelatedRequestLinks
        parent={request.parentRequest}
        supplements={request.childRequests}
        hrefOf={(id) => `/event/${eventId}/print/${id}`}
      />

      {showsCreditOffer(request.status, availableCredit) ? (
        <Alert tone="info">{creditOfferSentence(availableCredit)}</Alert>
      ) : null}

      {onsiteTemplate === "UNSUITABLE" ? <OnsiteTemplateAlert side="ORGANIZER" eventId={eventId} /> : null}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        <div className="order-2 lg:order-1">
          <OrganizerOrderSummary request={request} badgeCount={badgeCount}>
            {onsiteCounter ? <OnsiteCounterCard counter={onsiteCounter} /> : null}
          </OrganizerOrderSummary>
        </div>

        <section className="order-1 min-w-0 lg:order-2" aria-label="Échanges avec l'équipe Badge">
          <OrganizerConversation
            entriesUrl={`${base}/${requestId}/messages`}
            postUrl={ctx.isStaff || request.status === "DRAFT" ? null : `${base}/${requestId}/messages`}
            uploadUrl={`${base}/upload`}
            initialEntries={entries}
          />
        </section>

        <div className="order-3">
          <OrganizerQuoteColumn
            lines={lines}
            total={request.total}
            badgeCount={badgeCount}
            quoteVersion={request.quoteVersion}
            actions={{
              orgId,
              eventId,
              requestId,
              status: request.status,
              quoteVersion: request.quoteVersion,
              canAccept,
              archived: event.archived,
              readOnly: ctx.isStaff,
            }}
            pay={
              request.status === "ACCEPTED"
                ? {
                    orgId,
                    eventId,
                    requestId,
                    amount: request.acceptedTotal ?? request.total,
                    canPay: isOwner,
                    pending: hasPendingPayment(payments),
                  }
                : null
            }
            payments={payments}
          />
        </div>
      </div>
    </div>
  );
}
