import Link from "next/link";
import { Table } from "@/components/ui/Table";
import type { PaymentListItem } from "@/lib/payments-query";
import { PURPOSE_LABELS, STATUS_LABELS, fcfa, fmtDate } from "./status";

export function PaymentsTable({
  items,
  detailHref,
  showOrg,
  orgHref,
}: {
  items: PaymentListItem[];
  detailHref: (payment: PaymentListItem) => string;
  showOrg: boolean;
  orgHref?: (payment: PaymentListItem) => string;
}) {
  if (items.length === 0) return <p className="text-sm text-slate-400">Aucun paiement.</p>;
  return (
    <Table
      data={items}
      keyExtractor={(p) => p.id}
      columns={[
        { key: "date", header: "Date", render: (p) => fmtDate(p.createdAt) },
        ...(showOrg
          ? [
              {
                key: "org",
                header: "Organisation",
                render: (p: PaymentListItem) => {
                  const name = (
                    <span className="block max-w-[180px] truncate" title={p.orgName}>
                      {p.orgName}
                    </span>
                  );
                  return orgHref ? (
                    <Link href={orgHref(p)} className="text-blue-600 hover:underline">
                      {name}
                    </Link>
                  ) : (
                    name
                  );
                },
              },
            ]
          : []),
        { key: "type", header: "Type", render: (p) => PURPOSE_LABELS[p.purpose] },
        { key: "label", header: "Objet", render: (p) => p.label },
        { key: "amount", header: "Montant", render: (p) => fcfa(p.amount) },
        { key: "status", header: "Statut", render: (p) => STATUS_LABELS[p.status] },
        {
          key: "ref",
          header: "Référence",
          render: (p) => <span className="font-mono text-xs">{p.fedapayReference ?? "—"}</span>,
        },
        {
          key: "detail",
          header: "",
          render: (p) => (
            <Link href={detailHref(p)} className="text-sm font-medium text-blue-600 hover:underline">
              Voir
            </Link>
          ),
        },
      ]}
    />
  );
}
