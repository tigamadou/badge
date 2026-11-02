import Link from "next/link";
import type { PrintRequestStatus, PrintRequestType } from "@prisma/client";
import { PrintRequestStatusBadge } from "@/components/print/PrintRequestStatusBadge";
import { EmptyState } from "@/components/ui/Feedback";
import { TableFrame } from "@/components/ui/TableFrame";
import {
  PRINT_REQUEST_STATUS_LABELS,
  PRINT_REQUEST_TYPE_LABELS,
  formatFcfa,
} from "@/lib/print-requests/labels";

export type RequestRow = {
  id: string;
  reference: string;
  type: PrintRequestType;
  status: PrintRequestStatus;
  badgeCount: number;
  total: number;
  wantedBy: Date | null;
  org: { id: string; name: string };
  event: { id: string; title: string };
};

export type RequestFilters = {
  status: string;
  orgId: string;
  type: string;
  wantedFrom: string;
  wantedTo: string;
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

// Statuts filtrables : un brouillon n'est jamais visible du staff.
const STATUS_OPTIONS = (Object.keys(PRINT_REQUEST_STATUS_LABELS) as PrintRequestStatus[]).filter(
  (s) => s !== "DRAFT",
);

const FIELD = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900";

function pageHref(filters: RequestFilters, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/platform/print/orders${qs ? `?${qs}` : ""}`;
}

export function RequestList({
  rows,
  total,
  page,
  pageSize,
  filters,
  orgs,
}: {
  rows: RequestRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: RequestFilters;
  orgs: { id: string; name: string }[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Statut
          <select name="status" defaultValue={filters.status} className={FIELD}>
            <option value="">Tous</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {PRINT_REQUEST_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Organisation
          <select name="orgId" defaultValue={filters.orgId} className={`${FIELD} max-w-[14rem]`}>
            <option value="">Toutes</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Type
          <select name="type" defaultValue={filters.type} className={FIELD}>
            <option value="">Tous</option>
            <option value="ADVANCE">{PRINT_REQUEST_TYPE_LABELS.ADVANCE}</option>
            <option value="ONSITE">{PRINT_REQUEST_TYPE_LABELS.ONSITE}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Souhaitée du
          <input type="date" name="wantedFrom" defaultValue={filters.wantedFrom} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          au
          <input type="date" name="wantedTo" defaultValue={filters.wantedTo} className={FIELD} />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Filtrer
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon="inbox" title="Aucune commande" description="Aucune commande ne correspond à ces filtres." />
      ) : (
        <TableFrame>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Référence", "Organisation", "Évènement", "Type", "Badges", "Total", "Statut", "Date souhaitée"].map(
                  (h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium">
                    <Link href={`/platform/print/orders/${r.id}`} className="text-green-700 hover:underline">
                      {r.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.org.name}</td>
                  <td className="px-4 py-3">{r.event.title}</td>
                  <td className="whitespace-nowrap px-4 py-3">{PRINT_REQUEST_TYPE_LABELS[r.type]}</td>
                  <td className="px-4 py-3 tabular-nums">{r.badgeCount}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatFcfa(r.total)}</td>
                  <td className="px-4 py-3">
                    <PrintRequestStatusBadge status={r.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{r.wantedBy ? dateFmt.format(r.wantedBy) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      )}

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>
            {total} commande{total > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={pageHref(filters, page - 1)} className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100">
                Précédent
              </Link>
            ) : null}
            <span>
              Page {page} sur {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={pageHref(filters, page + 1)} className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100">
                Suivant
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
