import { formatFcfa } from "@/lib/print-requests/labels";

// Résumé minimal d'un devis pour les colonnes étroites : le total, le nombre de lignes et de badges.
export function QuoteTotals({
  total,
  lineCount,
  badgeCount,
}: {
  total: number;
  lineCount: number;
  badgeCount: number;
}) {
  return (
    <div>
      <p className="text-xs text-slate-400">Total estimé</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-navy">{formatFcfa(total)}</p>
      <p className="mt-1 text-[13px] text-slate-500">
        {`${lineCount} ligne${lineCount > 1 ? "s" : ""} · ${badgeCount} badge${badgeCount > 1 ? "s" : ""}`}
      </p>
    </div>
  );
}
