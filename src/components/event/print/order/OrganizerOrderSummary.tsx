import type { ReactNode } from "react";
import { PrintRequestStatusBadge } from "@/components/print/PrintRequestStatusBadge";
import { PRINT_REQUEST_TYPE_LABELS, formatFcfa } from "@/lib/print-requests/labels";
import type { PrintRequest } from "@prisma/client";

type Slot = { date?: unknown; from?: unknown; to?: unknown };

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export function onsiteScheduleText(schedule: unknown): string | null {
  if (!Array.isArray(schedule)) return null;
  return (schedule as Slot[]).map((s) => `${String(s.date)} · ${String(s.from)}–${String(s.to)}`).join("\n");
}

// Colonne de gauche : résumé de la commande (jamais de donnée interne).
export function OrganizerOrderSummary({
  request,
  badgeCount,
  children,
}: {
  request: Pick<
    PrintRequest,
    | "reference" | "status" | "type" | "total" | "quoteVersion" | "delivery" | "deliveryAddress"
    | "deliveryContactName" | "deliveryContactPhone" | "wantedBy" | "onsiteLocation" | "onsiteContactName"
    | "onsiteContactPhone" | "onsiteSchedule" | "notes"
  >;
  badgeCount: number;
  children?: ReactNode;
}) {
  return (
    <aside className="space-y-4" aria-label="Résumé de la commande">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-navy">{request.reference}</span>
          <span data-testid="order-status">
            <PrintRequestStatusBadge status={request.status} />
          </span>
        </div>
        <dl className="mt-3 space-y-3">
          <Info label="Type" value={PRINT_REQUEST_TYPE_LABELS[request.type]} />
          <Info label="Badges" value={`${badgeCount} badge${badgeCount > 1 ? "s" : ""}`} />
          {request.type === "ADVANCE" ? (
            <>
              <Info
                label="Mode de remise"
                value={request.delivery === "DELIVERY" ? "Livraison" : request.delivery ? "Retrait" : null}
              />
              <Info label="Adresse de livraison" value={request.deliveryAddress} />
              <Info label="Contact" value={request.deliveryContactName} />
              <Info label="Téléphone" value={request.deliveryContactPhone} />
              <Info label="Date souhaitée" value={request.wantedBy?.toLocaleDateString("fr-FR")} />
            </>
          ) : (
            <>
              <Info label="Lieu d'impression" value={request.onsiteLocation} />
              <Info label="Contact sur place" value={request.onsiteContactName} />
              <Info label="Téléphone" value={request.onsiteContactPhone} />
              <Info label="Créneaux de présence" value={onsiteScheduleText(request.onsiteSchedule)} />
            </>
          )}
          <Info label="Remarques" value={request.notes} />
        </dl>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="text-xs text-slate-400">Total</div>
          <div className="text-lg font-semibold tabular-nums text-slate-900">{formatFcfa(request.total)}</div>
        </div>
      </div>
      {children}
    </aside>
  );
}
