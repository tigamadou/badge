import { Icon } from "@/components/ui/Icon";
import { listPublicPlans, type PublicPlan } from "@/lib/public-plans";

const amountFormat = new Intl.NumberFormat("fr-FR");

const limit = (n: number | null) => (n === null ? "Illimité" : amountFormat.format(n));

function Check({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="inline-flex text-green-600" role="img" aria-label="Inclus">
      <Icon name="check" size={16} />
    </span>
  ) : (
    <span className="inline-flex text-slate-300" role="img" aria-label="Non inclus">
      <Icon name="minus" size={16} />
    </span>
  );
}

export function ComparisonTableView({ plans }: { plans: PublicPlan[] }) {
  if (plans.length === 0) return null;
  // Union des fonctionnalités, dans l'ordre de première apparition.
  const features = [...new Set(plans.flatMap((p) => p.features))];
  const baseRows: { label: string; cell: (p: PublicPlan) => string }[] = [
    { label: "Période", cell: (p) => (p.period === "ANNUAL" ? "Annuel" : "Mensuel") },
    { label: "Prix", cell: (p) => (p.price === null ? "Sur devis" : `${amountFormat.format(p.price)} FCFA`) },
    { label: "Événements", cell: (p) => limit(p.maxEvents) },
    { label: "Participants / événement", cell: (p) => limit(p.maxParticipantsPerEvent) },
  ];
  const cols = plans.length + 1;

  return (
    <div className="mt-[52px] overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-[13px] font-semibold text-slate-900">
            <th className="w-2/5 px-[18px] py-3.5 text-left">&nbsp;</th>
            {plans.map((p) => (
              <th key={p.id} className="px-[18px] py-3.5 text-center">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-sm">
          {baseRows.map((row) => (
            <tr key={row.label} className="border-b border-slate-100">
              <td className="px-[18px] py-3.5 text-slate-500">{row.label}</td>
              {plans.map((p) => (
                <td key={p.id} className="px-[18px] py-3.5 text-center text-slate-700">
                  {row.cell(p)}
                </td>
              ))}
            </tr>
          ))}
          {features.length > 0 && (
            <tr className="bg-slate-50">
              <td colSpan={cols} className="px-[18px] py-3.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-slate-900">
                Fonctionnalités
              </td>
            </tr>
          )}
          {features.map((feature) => (
            <tr key={feature} className="border-b border-slate-100">
              <td className="px-[18px] py-3.5 text-slate-500">{feature}</td>
              {plans.map((p) => (
                <td key={p.id} className="px-[18px] py-3.5 text-center">
                  <Check yes={p.features.includes(feature)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function ComparisonTable({ plans }: { plans?: PublicPlan[] } = {}) {
  return <ComparisonTableView plans={plans ?? (await listPublicPlans())} />;
}
