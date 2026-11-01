import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/ui/Icon";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { PrintRequestStatusBadge } from "@/components/print/PrintRequestStatusBadge";
import { QuoteLinesTable } from "@/components/print/QuoteLinesTable";
import { OnsiteTemplateAlert } from "@/components/print/OnsiteTemplateAlert";
import { onsiteTemplateStatus } from "@/lib/print-requests/onsite";
import { OnsiteCounterCard } from "@/components/print/OnsiteCounterCard";
import { loadOnsiteRequest } from "@/lib/print-requests/onsite-station";
import { showsOnsiteCounter } from "@/lib/print-requests/onsite-station-view";
import { PrintThread } from "@/components/print/PrintThread";
import { PrintRequestActions } from "@/components/event/print/PrintRequestActions";
import { requirePrintAccess } from "@/components/event/print/guard";
import { PRINT_REQUEST_TYPE_LABELS, formatFcfa } from "@/lib/print-requests/labels";
import { requestBadgeCount } from "@/lib/print-requests/service";
import { PrintPayButton } from "@/components/event/print/PrintPayButton";
import { hasPendingPayment } from "@/components/event/print/pay-button";
import { RelatedRequestLinks } from "@/components/print/RelatedRequestLinks";
import { creditOfferSentence, showsCreditOffer } from "@/lib/print-requests/credit-view";
import { getAvailableOrgPrintCredit } from "@/lib/print-requests/org-credit";
import { Alert } from "@/components/ui/Feedback";
import { PaymentHistory } from "@/components/admin/PaymentHistory";
import { PAYMENT_HISTORY_SELECT, toPaymentHistoryItem } from "@/lib/payment-history";

export const dynamic = "force-dynamic";

type Slot = { date?: unknown; from?: unknown; to?: unknown };

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm text-slate-900">{value}</dd>
    </div>
  );
}

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
  // Crédit encore libre pour cette demande (hors sa propre réservation) : proposé tant qu'elle est ouverte.
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
  // Compteur de l'impression sur place (demande principale, à partir du paiement).
  const onsiteCounter =
    request.type === "ONSITE" && request.parentRequestId === null && showsOnsiteCounter(request.status)
      ? (await loadOnsiteRequest(requestId)).counter
      : null;
  const isOwner = !ctx.isStaff && owner !== null;
  const canAccept = isOwner && request.status === "QUOTED";
  const base = `/api/org/${orgId}/events/${eventId}/print-requests`;
  const schedule = Array.isArray(request.onsiteSchedule)
    ? (request.onsiteSchedule as Slot[])
        .map((s) => `${String(s.date)} · ${String(s.from)}–${String(s.to)}`)
        .join("\n")
    : null;

  return (
    <div className="space-y-6">
      <Link
        href={`/event/${eventId}/print`}
        className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
      >
        <Icon name="arrow-left" size={14} /> Impression
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">{request.reference}</h1>
            <PrintRequestStatusBadge status={request.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {`${PRINT_REQUEST_TYPE_LABELS[request.type]} · ${badgeCount} badge${badgeCount > 1 ? "s" : ""}`}
            {request.quoteVersion > 0 ? ` · Devis v${request.quoteVersion}` : ""}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Total</div>
          <div className="text-lg font-semibold tabular-nums text-slate-900">{formatFcfa(request.total)}</div>
        </div>
      </div>

      <RelatedRequestLinks
        parent={request.parentRequest}
        supplements={request.childRequests}
        hrefOf={(id) => `/event/${eventId}/print/${id}`}
      />

      {showsCreditOffer(request.status, availableCredit) ? (
        <Alert tone="info">{creditOfferSentence(availableCredit)}</Alert>
      ) : null}

      {onsiteTemplate === "UNSUITABLE" ? <OnsiteTemplateAlert side="ORGANIZER" eventId={eventId} /> : null}

      {onsiteCounter ? <OnsiteCounterCard counter={onsiteCounter} /> : null}

      <PrintRequestActions
        orgId={orgId}
        eventId={eventId}
        requestId={requestId}
        status={request.status}
        quoteVersion={request.quoteVersion}
        canAccept={canAccept}
        archived={event.archived}
        readOnly={ctx.isStaff}
      />

      {request.status === "ACCEPTED" ? (
        <PrintPayButton
          orgId={orgId}
          eventId={eventId}
          requestId={requestId}
          amount={request.acceptedTotal ?? request.total}
          canPay={isOwner}
          pending={hasPendingPayment(payments)}
        />
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Lignes de la demande</h2>
        <QuoteLinesTable lines={lines} total={request.total} badgeCount={badgeCount} />
        <p className="mt-2 text-xs text-slate-400">Le prix définitif est fixé par l&apos;équipe Badge dans le devis.</p>
      </section>

      {payments.length > 0 ? (
        <Card>
          <CardHead title="Paiements" />
          <CardBody>
            <PaymentHistory payments={payments} />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHead title="Remise et informations" />
        <CardBody>
          <dl className="grid gap-3 sm:grid-cols-2">
            {request.type === "ADVANCE" ? (
              <>
                <Info label="Mode de remise" value={request.delivery === "DELIVERY" ? "Livraison" : request.delivery ? "Retrait" : null} />
                <Info label="Adresse de livraison" value={request.deliveryAddress} />
                <Info label="Contact" value={request.deliveryContactName} />
                <Info label="Téléphone" value={request.deliveryContactPhone} />
                <Info label="Date souhaitée" value={request.wantedBy?.toLocaleDateString("fr-FR")} />
              </>
            ) : (
              <>
                <Info label="Lieu d'impression" value={request.onsiteLocation} />
                <Info label="Contact sur place" value={request.onsiteContactName} />
                <Info label="Téléphone" value={request.onsiteContactPhone} />
                <Info label="Créneaux de présence" value={schedule} />
              </>
            )}
            <Info label="Remarques" value={request.notes} />
          </dl>
        </CardBody>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Échanges avec l&apos;équipe Badge</h2>
        <PrintThread
          entriesUrl={`${base}/${requestId}/messages`}
          postUrl={ctx.isStaff || request.status === "DRAFT" ? null : `${base}/${requestId}/messages`}
          uploadUrl={ctx.isStaff ? null : `${base}/upload`}
        />
      </section>
    </div>
  );
}
