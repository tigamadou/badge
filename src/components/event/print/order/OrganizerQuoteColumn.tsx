import type { ComponentProps } from "react";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { QuoteLinesTable } from "@/components/print/QuoteLinesTable";
import { PaymentHistory } from "@/components/admin/PaymentHistory";

type Payments = ComponentProps<typeof PaymentHistory>["payments"];

// Colonne de droite : devis en lecture, total et paiements (les actions sont dans l'en-tête de la page).
export function OrganizerQuoteColumn({
  lines,
  total,
  badgeCount,
  quoteVersion,
  payments,
}: {
  lines: ComponentProps<typeof QuoteLinesTable>["lines"];
  total: number;
  badgeCount: number;
  quoteVersion: number;
  payments: Payments;
}) {
  return (
    <aside className="space-y-4" aria-label="Devis">
      <Card>
        <CardHead title={quoteVersion > 0 ? `Devis v${quoteVersion}` : "Lignes de la commande"} />
        <CardBody className="space-y-3">
          <QuoteLinesTable compact lines={lines} total={total} badgeCount={badgeCount} />
          <p className="text-xs text-slate-400">Le prix définitif est fixé par l&apos;équipe Badge dans le devis.</p>
        </CardBody>
      </Card>

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
