"use client";

import type { StaffRole } from "@prisma/client";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { PaymentHistory, type PaymentHistoryItem } from "@/components/admin/PaymentHistory";
import { OnsiteTemplateAlert } from "@/components/print/OnsiteTemplateAlert";
import type { OnsiteCounter } from "@/lib/print-requests/onsite-counter";
import type { OrderSheetView } from "@/lib/print-sheets/order-sheet";
import { OrderSheetPanel } from "../OrderSheetPanel";
import { OnsiteRequestPanel } from "../OnsiteRequestPanel";
import { QuoteEditor } from "../QuoteEditor";
import { RequestCreditPanel, type StaffCreditData } from "../RequestCreditPanel";
import { RequestStatusActions } from "../RequestStatusActions";
import { canEditQuote } from "../request-actions";
import type { ProductOption, RequestDetailData } from "../request-types";

// Colonne droite : devis éditable, actions de statut, crédit, impression sur place, planche, paiements.
export function OrderQuoteColumn({
  requestId,
  role,
  data,
  products,
  payments,
  onsiteCounter,
  credit,
  sheet,
  onChanged,
}: {
  requestId: string;
  role: StaffRole;
  data: RequestDetailData;
  products: ProductOption[];
  payments: PaymentHistoryItem[];
  onsiteCounter: OnsiteCounter | null;
  credit: StaffCreditData | null;
  sheet: OrderSheetView | null;
  onChanged: () => void;
}) {
  const { request, event, items, lines, onsiteTemplate } = data;
  // /api/files refuse les planches (print-sheets/) à STAFF_OBSERVER : pas de lien mort pour lui.
  const visibleSheet = sheet && role === "STAFF_OBSERVER" ? { ...sheet, downloadUrl: null } : sheet;
  return (
    <div className="min-w-0 space-y-4">
      {onsiteTemplate === "UNSUITABLE" && <OnsiteTemplateAlert side="STAFF" eventId={event.id} />}

      <RequestStatusActions
        request={request}
        eventId={event.id}
        orgId={event.org.id}
        items={items}
        role={role}
        onChanged={onChanged}
      />

      <QuoteEditor
        requestId={requestId}
        lines={lines}
        canEdit={canEditQuote(request.status, role)}
        products={products}
        onChanged={onChanged}
      />

      {credit && (
        <RequestCreditPanel requestId={requestId} status={request.status} role={role} credit={credit} onChanged={onChanged} />
      )}

      {onsiteCounter && (
        <OnsiteRequestPanel requestId={requestId} status={request.status} role={role} initialCounter={onsiteCounter} />
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
