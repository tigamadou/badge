"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Permission } from "@/lib/permissions";
import { PrintRequestStatusBadge } from "@/components/print/PrintRequestStatusBadge";
import { Alert } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { FullHeightPage } from "@/components/layout/FullHeightPage";
import { OrderModal } from "@/components/print/OrderModal";
import { OrderTabs } from "@/components/print/OrderTabs";
import { useIsWide } from "@/components/print/useIsWide";
import type { PaymentHistoryItem } from "@/components/admin/PaymentHistory";
import { toastApiError } from "@/lib/toast";
import type { OnsiteCounter } from "@/lib/print-requests/onsite-counter";
import type { OrderSheetView } from "@/lib/print-sheets/order-sheet";
import type { StaffCreditData } from "./RequestCreditPanel";
import { OrderConversation } from "./order/OrderConversation";
import { OrderQuoteColumn } from "./order/OrderQuoteColumn";
import { OrderSummaryColumn } from "./order/OrderSummaryColumn";
import { OrderBadgesButton } from "./order/OrderBadgesButton";
import { QuoteEditor } from "./QuoteEditor";
import { RequestStatusActions } from "./RequestStatusActions";
import { canEditQuote } from "./request-actions";
import { requestUrl } from "./request-fetch";
import type { ProductOption, RequestDetailData } from "./request-types";

// GET /api/platform/print/requests/{id} renvoie aussi le total accepté (requestDTO).
type OrderDetailData = RequestDetailData & {
  request: RequestDetailData["request"] & { acceptedTotal: number | null };
};

// Page d'une commande côté staff : conversation à trois colonnes (résumé, fil, devis et actions).
export function RequestDetail({
  requestId,
  permissions,
  canOperateOnsite = false,
  products,
  payments = [],
  onsiteCounter = null,
  credit = null,
  sheet = null,
  parentRequest = null,
  supplements = [],
}: {
  requestId: string;
  permissions: Permission[];
  canOperateOnsite?: boolean;
  products: ProductOption[];
  payments?: PaymentHistoryItem[];
  onsiteCounter?: OnsiteCounter | null;
  credit?: StaffCreditData | null;
  sheet?: OrderSheetView | null;
  parentRequest?: { id: string; reference: string } | null;
  supplements?: { id: string; reference: string }[];
}) {
  const router = useRouter();
  const [data, setData] = useState<OrderDetailData | null>(null);
  const [failed, setFailed] = useState(false);
  const [threadKey, setThreadKey] = useState(0);
  const [editQuote, setEditQuote] = useState(false);
  const wide = useIsWide();

  const load = useCallback(async () => {
    try {
      const res = await fetch(requestUrl(requestId));
      if (!res.ok) throw res;
      setData((await res.json()) as OrderDetailData);
      setFailed(false);
    } catch (err) {
      await toastApiError(err);
      setFailed(true);
    }
  }, [requestId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial
    void load();
  }, [load]);

  // Après une action : recharge la commande (résumé, devis) et le fil, et le compteur du menu (layout serveur).
  const onChanged = useCallback(() => {
    void load();
    setThreadKey((k) => k + 1);
    router.refresh();
  }, [load, router]);

  // Le fil vient d'être lu : le compteur du menu (layout serveur) doit suivre.
  const refreshMenu = useCallback(() => router.refresh(), [router]);

  if (!data) {
    return (
      <FullHeightPage>
        <div className="p-4">
          {failed ? (
            <Alert tone="err">Cette commande est introuvable ou inaccessible.</Alert>
          ) : (
            <p className="text-sm text-slate-400">Chargement…</p>
          )}
        </div>
      </FullHeightPage>
    );
  }

  const { request, items } = data;
  const permissionSet = new Set(permissions);
  const canPost = permissionSet.has("print.requests.messages.send");
  const editable = canEditQuote(request.status, permissionSet);
  const currentQuote = request.quoteVersion > 0 ? { version: request.quoteVersion, lines: data.lines } : undefined;

  const summary = (
    <OrderSummaryColumn data={data} acceptedTotal={request.acceptedTotal} parentRequest={parentRequest} supplements={supplements} />
  );
  const conversation = (
    <OrderConversation
      messagesUrl={requestUrl(requestId, "/messages")}
      uploadUrl={`/api/platform/upload?context=print-request&requestId=${requestId}`}
      canPost={canPost}
      refreshKey={threadKey}
      onFirstRead={refreshMenu}
      currentQuote={currentQuote}
    />
  );
  const quote = (
    <OrderQuoteColumn
      requestId={requestId}
      permissions={permissions}
      canOperateOnsite={canOperateOnsite}
      data={data}
      payments={payments}
      onsiteCounter={onsiteCounter}
      credit={credit}
      sheet={sheet}
      onChanged={onChanged}
    />
  );

  return (
    <FullHeightPage>
      <div className="flex-none border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <Link href="/platform/print/orders" className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-800">
          <Icon name="arrow-left" size={14} /> Commandes
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-xl font-semibold text-navy">{request.reference}</h1>
          <PrintRequestStatusBadge status={request.status} />
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {request.type === "ADVANCE" && items.length > 0 ? (
              <OrderBadgesButton count={items.length} fetchUrl={requestUrl(requestId, "/items")} />
            ) : null}
            {editable ? (
              <Button type="button" variant="secondary" onClick={() => setEditQuote(true)}>
                Modifier le devis
              </Button>
            ) : null}
            <RequestStatusActions
              request={request}
              eventId={data.event.id}
              orgId={data.event.org.id}
              items={items}
              permissions={permissions}
              onChanged={onChanged}
            />
          </div>
        </div>
      </div>

      {wide ? (
        <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_340px] gap-4 p-4">
          <div className="min-h-0 overflow-y-auto">{summary}</div>
          <div className="flex min-h-0 flex-col">{conversation}</div>
          <div className="min-h-0 overflow-y-auto">{quote}</div>
        </div>
      ) : (
        <OrderTabs
          defaultId="discussion"
          tabs={[
            { id: "infos", label: "Infos", panel: <div className="p-3">{summary}</div> },
            { id: "discussion", label: "Discussion", panel: <div className="flex min-h-0 flex-1 flex-col p-3">{conversation}</div> },
            { id: "quote", label: "Devis", panel: <div className="p-3">{quote}</div> },
          ]}
        />
      )}

      <OrderModal open={editQuote} onClose={() => setEditQuote(false)} title="Modifier le devis" size="xl">
        <QuoteEditor
          requestId={requestId}
          lines={data.lines}
          canEdit={editable}
          products={products}
          onChanged={onChanged}
          bare
        />
      </OrderModal>
    </FullHeightPage>
  );
}
