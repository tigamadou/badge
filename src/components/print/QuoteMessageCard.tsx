import { formatFcfa } from "@/lib/print-requests/labels";
import { toneClasses } from "./entry-tone";

export interface QuoteCardLine {
  label: string;
  quantity: number;
  unitPrice: number;
}

// Carte d'une version de devis. Avec `lines` : tableau complet ; sans : évolutions du récapitulatif.
// Tout est rendu en texte par React (jamais de HTML injecté).
export function QuoteMessageCard({
  version,
  total,
  rows,
  lines,
}: {
  version: number;
  total: string;
  rows: string[];
  lines?: QuoteCardLine[];
}) {
  return (
    <div data-testid="quote-card" className={`rounded-lg p-3 ${toneClasses.quote}`}>
      <p className="text-sm font-semibold">Devis v{version}</p>
      <div className="mt-2 overflow-x-auto rounded-md bg-white/70">
        {lines ? (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-indigo-700">
                <th className="px-2 py-1.5">Ligne</th>
                <th className="px-2 py-1.5 text-right">Quantité</th>
                <th className="px-2 py-1.5 text-right">Prix unitaire</th>
                <th className="px-2 py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-t border-indigo-100">
                  <td className="px-2 py-1.5 break-words">{line.label}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{line.quantity}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatFcfa(line.unitPrice)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatFcfa(line.quantity * line.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-indigo-700">
                <th className="px-2 py-1.5">Ligne</th>
                <th className="px-2 py-1.5">Évolution</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const [label, ...rest] = row.split(" : ");
                return (
                  <tr key={i} className="border-t border-indigo-100">
                    <td className="px-2 py-1.5 break-words">{rest.length ? label : "—"}</td>
                    <td className="px-2 py-1.5 break-words">{rest.length ? rest.join(" : ") : row}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold">Total : {total}</p>
    </div>
  );
}
