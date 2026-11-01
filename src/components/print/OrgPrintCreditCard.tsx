import { formatFcfa } from "@/lib/print-requests/labels";
import { movementLabel, showsCreditCard, type CreditMovementView } from "@/lib/print-requests/credit-view";

// Crédit d'impression de l'organisation : solde et mouvements. Partagé organisateur / staff.
export function OrgPrintCreditCard({ balance, movements }: { balance: number; movements: CreditMovementView[] }) {
  if (!showsCreditCard(balance, movements.length)) return null;
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4" data-testid="org-print-credit">
      <h2 className="text-base font-semibold tabular-nums text-slate-900">
        {`Crédit d'impression : ${formatFcfa(balance)}`}
      </h2>
      {movements.length > 0 ? (
        <ul className="divide-y divide-slate-100 text-sm text-slate-600">
          {movements.map((m) => (
            <li key={m.id} className="py-1.5 tabular-nums">
              {movementLabel(m)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
