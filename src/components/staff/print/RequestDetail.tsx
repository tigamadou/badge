"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StaffRole } from "@prisma/client";
import { PrintRequestStatusBadge } from "@/components/print/PrintRequestStatusBadge";
import { Alert } from "@/components/ui/Feedback";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import type { PaymentHistoryItem } from "@/components/admin/PaymentHistory";
import { toastApiError } from "@/lib/toast";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import type { OnsiteCounter } from "@/lib/print-requests/onsite-counter";
import type { OrderSheetView } from "@/lib/print-sheets/order-sheet";
import type { StaffCreditData } from "./RequestCreditPanel";
import { OrderConversation } from "./order/OrderConversation";
import { OrderQuoteColumn } from "./order/OrderQuoteColumn";
import { OrderSummaryColumn } from "./order/OrderSummaryColumn";
import { requestUrl } from "./request-fetch";
import type { ProductOption, RequestDetailData } from "./request-types";

// GET /api/platform/print/requests/{id} renvoie aussi le total accepté (requestDTO).
type OrderDetailData = RequestDetailData & {
  request: RequestDetailData["request"] & { acceptedTotal: number | null };
};

// Page d'une commande côté staff : conversation à trois colonnes (résumé, fil, devis et actions).
export function RequestDetail({
  requestId,
  role,
  products,
  payments = [],
  onsiteCounter = null,
  credit = null,
  sheet = null,
  parentRequest = null,
  supplements = [],
}: {
  requestId: string;
  role: StaffRole;
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
  const [showBadges, setShowBadges] = useState(false);

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
    return failed ? (
      <Alert tone="err">Cette commande est introuvable ou inaccessible.</Alert>
    ) : (
      <p className="text-sm text-slate-400">Chargement…</p>
    );
  }

  const { request, items } = data;
  const printed = items.filter((i) => i.badgePrinted).length;
  const canPost = staffRoleAtLeast(role, "STAFF_SUPPORT");

  return (
    <div className="space-y-4">
      <div>
        <Link href="/platform/print/orders" className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-800">
          <Icon name="arrow-left" size={14} /> Commandes
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{request.reference}</h1>
          <PrintRequestStatusBadge status={request.status} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_380px]">
        <OrderSummaryColumn
          data={data}
          acceptedTotal={request.acceptedTotal}
          parentRequest={parentRequest}
          supplements={supplements}
        />
        <OrderConversation
          messagesUrl={requestUrl(requestId, "/messages")}
          uploadUrl={`/api/platform/upload?context=print-request&requestId=${requestId}`}
          canPost={canPost}
          refreshKey={threadKey}
          onFirstRead={refreshMenu}
        />
        <OrderQuoteColumn
          requestId={requestId}
          role={role}
          data={data}
          products={products}
          payments={payments}
          onsiteCounter={onsiteCounter}
          credit={credit}
          sheet={sheet}
          onChanged={onChanged}
        />
      </div>

      {request.type === "ADVANCE" && (
        <Card>
          <CardHead
            title="Badges"
            subtitle={`${items.length} badge${items.length > 1 ? "s" : ""} · ${printed} imprimé${printed > 1 ? "s" : ""}`}
            action={
              items.length > 0 ? (
                <button
                  type="button"
                  aria-expanded={showBadges}
                  onClick={() => setShowBadges((v) => !v)}
                  className="text-[13px] font-medium text-green-700 hover:underline"
                >
                  {showBadges ? "Replier la liste" : "Afficher la liste"}
                </button>
              ) : undefined
            }
          />
          {showBadges && (
            <CardBody className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-medium">Nom</th>
                    <th className="px-3 py-2 font-medium">Catégorie</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                    <th className="px-3 py-2 font-medium">Imprimé</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.registrationId} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        {i.firstName} {i.lastName}
                      </td>
                      <td className="px-3 py-2">{i.categoryName}</td>
                      <td className="px-3 py-2">{i.status}</td>
                      <td className="px-3 py-2">{i.badgePrinted ? "Oui" : "Non"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          )}
        </Card>
      )}
    </div>
  );
}
