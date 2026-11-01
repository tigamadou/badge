import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Table } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/Feedback";
import { PrintRequestStatusBadge } from "@/components/print/PrintRequestStatusBadge";
import { requirePrintAccess } from "@/components/event/print/guard";
import { OrgPrintCreditCard } from "@/components/print/OrgPrintCreditCard";
import { getOrgPrintCreditBalance, listOrgPrintCreditMovements } from "@/lib/print-requests/org-credit";
import { PRINT_REQUEST_TYPE_LABELS, formatFcfa } from "@/lib/print-requests/labels";

export const dynamic = "force-dynamic";

export default async function PrintRequestsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, ctx, orgId } = await requirePrintAccess(eventId, "/print");
  const [creditBalance, creditMovements] = await Promise.all([
    getOrgPrintCreditBalance(orgId),
    listOrgPrintCreditMovements(orgId),
  ]);
  const rows = await prisma.printRequest.findMany({
    where: { eventId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { _count: { select: { items: true } } },
  });
  const data = rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    type: r.type,
    status: r.status,
    badgeCount: r.type === "ADVANCE" ? r._count.items : (r.estimatedQuantity ?? 0),
    total: r.total,
    submittedAt: r.submittedAt,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Impression</h1>
          <p className="mt-0.5 text-sm text-slate-400">Demandes d&apos;impression de badges et devis</p>
        </div>
        {!event.archived && !ctx.isStaff ? (
          <Link
            href={`/event/${eventId}/print/new`}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            Nouvelle demande
          </Link>
        ) : null}
      </div>
      <OrgPrintCreditCard balance={creditBalance} movements={creditMovements} />
      {data.length === 0 ? (
        <EmptyState icon="printer" title="Aucune demande d'impression pour cet évènement." />
      ) : (
        <Table
          data={data}
          keyExtractor={(r) => r.id}
          columns={[
            {
              key: "reference",
              header: "Référence",
              render: (r) => (
                <Link href={`/event/${eventId}/print/${r.id}`} className="font-medium text-green-700 hover:underline">
                  {r.reference}
                </Link>
              ),
            },
            { key: "type", header: "Type", render: (r) => PRINT_REQUEST_TYPE_LABELS[r.type] },
            { key: "badges", header: "Badges", render: (r) => <span className="tabular-nums">{r.badgeCount}</span> },
            {
              key: "total",
              header: "Total",
              render: (r) => <span className="whitespace-nowrap tabular-nums">{formatFcfa(r.total)}</span>,
            },
            { key: "status", header: "Statut", render: (r) => <PrintRequestStatusBadge status={r.status} /> },
            {
              key: "submittedAt",
              header: "Envoyée le",
              render: (r) => (r.submittedAt ? r.submittedAt.toLocaleDateString("fr-FR") : "—"),
            },
          ]}
        />
      )}
    </div>
  );
}
