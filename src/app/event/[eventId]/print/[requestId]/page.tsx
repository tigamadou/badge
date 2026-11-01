import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/ui/Icon";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { PrintRequestStatusBadge } from "@/components/print/PrintRequestStatusBadge";
import { QuoteLinesTable } from "@/components/print/QuoteLinesTable";
import { PrintThread } from "@/components/print/PrintThread";
import { PrintRequestActions } from "@/components/event/print/PrintRequestActions";
import { requirePrintAccess } from "@/components/event/print/guard";
import { PRINT_REQUEST_TYPE_LABELS, formatFcfa } from "@/lib/print-requests/labels";
import { requestBadgeCount } from "@/lib/print-requests/service";

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
  const request = await prisma.printRequest.findFirst({ where: { id: requestId, eventId } });
  if (!request) notFound();

  const [lines, badgeCount, owner] = await Promise.all([
    prisma.printQuoteLine.findMany({
      where: { requestId, removedAt: null },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
    requestBadgeCount(prisma, request),
    prisma.orgMembership.findFirst({
      where: { userId: ctx.user.id, orgId, role: "OWNER" },
      select: { userId: true },
    }),
  ]);
  const canAccept = !ctx.isStaff && owner !== null && request.status === "QUOTED";
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

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Lignes de la demande</h2>
        <QuoteLinesTable lines={lines} total={request.total} badgeCount={badgeCount} />
        <p className="mt-2 text-xs text-slate-400">Le prix définitif est fixé par l&apos;équipe Badge dans le devis.</p>
      </section>

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
          postUrl={ctx.isStaff ? null : `${base}/${requestId}/messages`}
          uploadUrl={ctx.isStaff ? null : `${base}/upload`}
        />
      </section>
    </div>
  );
}
