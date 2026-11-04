import { formatFcfa } from "@/lib/print-requests/labels";
import { TableFrame } from "@/components/ui/TableFrame";

export type QuoteLineView = {
  id: string;
  label: string;
  optionsSnapshot: unknown;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type Snapshot = {
  optionName?: unknown;
  labels?: unknown;
  text?: unknown;
  fileKey?: unknown;
  split?: unknown;
};

const str = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v) : "");

// Résumé texte des options figées d'une ligne (jamais du HTML : rendu en texte par React).
export function describeSnapshot(snapshot: unknown): string[] {
  if (!Array.isArray(snapshot)) return [];
  return (snapshot as Snapshot[]).flatMap((s) => {
    if (typeof s !== "object" || s === null) return [];
    const name = str(s.optionName);
    let value = "";
    if (Array.isArray(s.labels) && s.labels.length > 0) value = s.labels.map(str).join(", ");
    else if (Array.isArray(s.split) && s.split.length > 0) {
      value = (s.split as { label?: unknown; quantity?: unknown }[])
        .map((p) => `${str(p?.label)} × ${str(p?.quantity)}`)
        .join(", ");
    } else if (s.text) value = str(s.text);
    else if (s.fileKey) value = "fichier joint";
    if (!name && !value) return [];
    return [name && value ? `${name} : ${value}` : name || value];
  });
}

// Lignes du devis : libellé, options figées, quantité, prix unitaire, total de ligne, total général.
export function QuoteLinesTable({
  lines,
  total,
  badgeCount,
  compact = false,
}: {
  lines: QuoteLineView[];
  total: number;
  badgeCount: number;
  // Variante resserrée pour les colonnes étroites.
  compact?: boolean;
}) {
  const cell = compact ? "px-2 py-2" : "px-4 py-3";
  return (
    <div>
      <TableFrame>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <th className={cell}>Ligne</th>
              <th className={`${cell} text-right`}>Quantité</th>
              <th className={`${cell} text-right`}>Prix unitaire</th>
              <th className={`${cell} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const options = describeSnapshot(line.optionsSnapshot);
              return (
                <tr key={line.id} className="border-b border-slate-100 align-top">
                  <td className={cell}>
                    <div className="font-medium text-slate-900">{line.label}</div>
                    {options.map((o) => (
                      <div key={o} className="text-xs text-slate-500">
                        {o}
                      </div>
                    ))}
                  </td>
                  <td className={`whitespace-nowrap ${cell} text-right tabular-nums`}>{line.quantity}</td>
                  <td className={`whitespace-nowrap ${cell} text-right tabular-nums`}>{formatFcfa(line.unitPrice)}</td>
                  <td className={`whitespace-nowrap ${cell} text-right font-medium tabular-nums`}>
                    {formatFcfa(line.lineTotal)}
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Aucune ligne pour le moment.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50">
              <td colSpan={3} className={`${cell} text-right text-sm font-semibold text-slate-900`}>
                {`Total estimé (${badgeCount} badge${badgeCount > 1 ? "s" : ""})`}
              </td>
              <td className={`whitespace-nowrap ${cell} text-right text-sm font-semibold tabular-nums text-slate-900`}>
                {formatFcfa(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </TableFrame>
    </div>
  );
}
