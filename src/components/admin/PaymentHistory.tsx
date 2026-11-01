import type { PaymentStatus } from "@prisma/client";
import { Table } from "@/components/ui/Table";

export interface PaymentHistoryItem {
  id: string;
  createdAt: Date;
  label: string;
  amount: number;
  status: PaymentStatus;
  fedapayReference: string | null;
}

const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Payé",
  DECLINED: "Refusé",
  CANCELED: "Annulé",
  EXPIRED: "Expiré",
};

const amountFormat = new Intl.NumberFormat("fr-FR");

export function PaymentHistory({ payments }: { payments: PaymentHistoryItem[] }) {
  if (payments.length === 0) {
    return <p className="text-sm text-slate-400">Aucun paiement.</p>;
  }
  return (
    <Table
      data={payments}
      keyExtractor={(p) => p.id}
      columns={[
        { key: "date", header: "Date", render: (p) => new Date(p.createdAt).toLocaleDateString("fr-FR") },
        { key: "label", header: "Objet", render: (p) => p.label },
        { key: "amount", header: "Montant", render: (p) => `${amountFormat.format(p.amount)} FCFA` },
        { key: "status", header: "Statut", render: (p) => STATUS_LABELS[p.status] },
        {
          key: "ref",
          header: "Référence",
          render: (p) => <span className="font-mono text-xs">{p.fedapayReference ?? "—"}</span>,
        },
      ]}
    />
  );
}
