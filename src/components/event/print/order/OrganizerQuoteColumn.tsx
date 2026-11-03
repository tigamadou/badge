import type { ComponentProps } from "react";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { QuoteLinesTable } from "@/components/print/QuoteLinesTable";
import { PaymentHistory } from "@/components/admin/PaymentHistory";
import { PrintRequestActions } from "@/components/event/print/PrintRequestActions";
import { PrintPayButton } from "@/components/event/print/PrintPayButton";

type Payments = ComponentProps<typeof PaymentHistory>["payments"];

// Colonne de droite : devis en lecture, total, actions selon le statut et le rôle.
export function OrganizerQuoteColumn({
  lines,
  total,
  badgeCount,
  quoteVersion,
  actions,
  pay,
  payments,
}: {
  lines: ComponentProps<typeof QuoteLinesTable>["lines"];
  total: number;
  badgeCount: number;
  quoteVersion: number;
  actions: ComponentProps<typeof PrintRequestActions>;
  pay: ComponentProps<typeof PrintPayButton> | null;
  payments: Payments;
}) {
  return (
    <aside className="space-y-4" aria-label="Devis">
      <Card>
        <CardHead title={quoteVersion > 0 ? `Devis v${quoteVersion}` : "Lignes de la commande"} />
        <CardBody className="space-y-3">
          <QuoteLinesTable lines={lines} total={total} badgeCount={badgeCount} />
          <p className="text-xs text-slate-400">Le prix définitif est fixé par l&apos;équipe Badge dans le devis.</p>
        </CardBody>
      </Card>

      <div className="space-y-3">
        <PrintRequestActions {...actions} />
        {pay ? <PrintPayButton {...pay} /> : null}
      </div>

      {payments.length > 0 ? (
        <Card>
          <CardHead title="Paiements" />
          <CardBody>
            <PaymentHistory payments={payments} />
          </CardBody>
        </Card>
      ) : null}
    </aside>
  );
}
