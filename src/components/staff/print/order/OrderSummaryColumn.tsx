import type { ReactNode } from "react";
import { PrintRequestStatusBadge } from "@/components/print/PrintRequestStatusBadge";
import { RelatedRequestLinks } from "@/components/print/RelatedRequestLinks";
import { PRINT_REQUEST_TYPE_LABELS, formatFcfa } from "@/lib/print-requests/labels";
import { formatBadgeSize } from "../request-actions";
import type { RequestDetailData } from "../request-types";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-800">{children || "—"}</dd>
    </div>
  );
}

// Colonne gauche : résumé actualisé de la commande (le serveur le recharge après chaque action).
export function OrderSummaryColumn({
  data,
  acceptedTotal,
  parentRequest,
  supplements,
}: {
  data: RequestDetailData;
  acceptedTotal: number | null;
  parentRequest: { id: string; reference: string } | null;
  supplements: { id: string; reference: string }[];
}) {
  const { request, event, template, items } = data;
  const duplex = template ? template.pages > 1 : false;
  return (
    <aside aria-label="Résumé de la commande" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <PrintRequestStatusBadge status={request.status} />
        <span className="text-sm text-slate-500">{PRINT_REQUEST_TYPE_LABELS[request.type]}</span>
      </div>
      <RelatedRequestLinks parent={parentRequest} supplements={supplements} hrefOf={(id) => `/platform/print/orders/${id}`} />
      <dl className="grid gap-3">
        <Field label="Badges">
          {items.length > 0 ? `${items.length} badge${items.length > 1 ? "s" : ""}` : request.estimatedQuantity?.toString() ?? ""}
        </Field>
        {request.type === "ADVANCE" ? (
          <Field label="Livraison">
            {[
              request.delivery === "DELIVERY" ? "Livraison" : request.delivery === "PICKUP" ? "Retrait" : "",
              request.deliveryAddress,
              [request.deliveryContactName, request.deliveryContactPhone].filter(Boolean).join(" · "),
            ]
              .filter(Boolean)
              .join(" — ")}
          </Field>
        ) : (
          <Field label="Sur place">
            {[request.onsiteLocation, [request.onsiteContactName, request.onsiteContactPhone].filter(Boolean).join(" · ")]
              .filter(Boolean)
              .join(" — ")}
          </Field>
        )}
      </dl>
      <details className="group border-t border-slate-100 pt-3">
        <summary className="cursor-pointer text-[13px] font-medium text-slate-600 hover:text-slate-900">Détails</summary>
        <dl className="mt-3 grid gap-3">
          <Field label="Impression">{template ? (duplex ? "Recto-verso" : "Recto seul") : ""}</Field>
          <Field label="Template">
            {template ? `${template.label} · ${formatBadgeSize(template.widthPx, template.heightPx)}` : ""}
          </Field>
          <Field label="Date souhaitée">{fmtDate(request.wantedBy)}</Field>
          <Field label="Envoyée le">{request.submittedAt ? dateTimeFmt.format(new Date(request.submittedAt)) : ""}</Field>
          <Field label="Total du devis">{formatFcfa(request.total)}</Field>
          <Field label="Total accepté">{acceptedTotal !== null ? formatFcfa(acceptedTotal) : ""}</Field>
          <Field label="Remarques">
            <span className="whitespace-pre-wrap">{request.notes}</span>
          </Field>
        </dl>
      </details>
    </aside>
  );
}
