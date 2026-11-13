"use client";

import type { Permission } from "@/lib/permissions";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { PaymentHistory, type PaymentHistoryItem } from "@/components/admin/PaymentHistory";
import { OnsiteTemplateAlert } from "@/components/print/OnsiteTemplateAlert";
import type { OnsiteCounter } from "@/lib/print-requests/onsite-counter";
import type { OrderSheetView } from "@/lib/print-sheets/order-sheet";
import { OrderSheetPanel } from "../OrderSheetPanel";
import { OnsiteRequestPanel } from "../OnsiteRequestPanel";
import { QuoteTotals } from "@/components/print/QuoteTotals";
import { RequestCreditPanel, type StaffCreditData } from "../RequestCreditPanel";
import type { RequestDetailData } from "../request-types";

// Colonne droite : organisation, devis (lecture ; l'édition passe par la modale de l'en-tête), crédit, impression sur place, planche, paiements.
export function OrderQuoteColumn({
  requestId,
  permissions,
  canOperateOnsite,
  data,
  payments,
  onsiteCounter,
  credit,
  sheet,
  onChanged,
}: {
  requestId: string;
  permissions: Permission[];
  canOperateOnsite: boolean;
  data: RequestDetailData;
  payments: PaymentHistoryItem[];
  onsiteCounter: OnsiteCounter | null;
  credit: StaffCreditData | null;
  sheet: OrderSheetView | null;
  onChanged: () => void;
}) {
  const { request, event, items, lines, onsiteTemplate } = data;
  // /api/files refuse les planches (print-sheets/) sans `print.sheets.read` : pas de lien mort.
  const visibleSheet = sheet && !permissions.includes("print.sheets.read") ? { ...sheet, downloadUrl: null } : sheet;
  return (
    <div className="min-w-0 space-y-4">
      {onsiteTemplate === "UNSUITABLE" && <OnsiteTemplateAlert side="STAFF" eventId={event.id} />}

      <Card>
        <CardHead title="Organisation" />
        <CardBody>
          <dl className="grid gap-3 text-sm">
            <div className="min-w-0">
              <dt className="text-xs text-slate-400">Organisation</dt>
              <dd className="mt-0.5 break-words text-slate-800">{event.org.name}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-slate-400">Évènement</dt>
              <dd className="mt-0.5 break-words text-slate-800">{event.title}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-slate-400">Contact</dt>
              <dd className="mt-0.5 break-words text-slate-800">
                {[event.org.contactEmail, event.org.contactPhone].filter(Boolean).join(" · ") || "—"}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Devis" />
        <CardBody>
          <QuoteTotals total={lines.reduce((sum, l) => sum + l.lineTotal, 0)} lineCount={lines.length} badgeCount={items.length} />
        </CardBody>
      </Card>

      {credit && (
        <RequestCreditPanel requestId={requestId} status={request.status} permissions={permissions} credit={credit} onChanged={onChanged} />
      )}

      {onsiteCounter && (
        <OnsiteRequestPanel requestId={requestId} status={request.status}
          permissions={permissions}
          canOperateOnsite={canOperateOnsite}
          initialCounter={onsiteCounter}
        />
      )}

      <OrderSheetPanel sheet={visibleSheet} sheetsHref={`/platform/print/sheets?printRequestId=${requestId}`} />

      {payments.length > 0 && (
        <Card>
          <CardHead title="Paiements" />
          <CardBody>
            <PaymentHistory payments={payments} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
