import { Fragment } from "react";
import { Icon } from "@/components/ui/Icon";

type Cell = "yes" | "no" | string;
type Row = { label: string; values: [Cell, Cell, Cell] };
type Section = { group: string; rows: Row[] };

const SECTIONS: Section[] = [
  {
    group: "Inscriptions",
    rows: [
      { label: "Événements actifs", values: ["1", "Illimités", "Illimités"] },
      { label: "Inscriptions / mois", values: ["100", "10 000", "Sur mesure"] },
      { label: "Formulaires personnalisés", values: ["yes", "yes", "yes"] },
      { label: "Listes de blocage", values: ["no", "yes", "yes"] },
    ],
  },
  {
    group: "Badges & accès",
    rows: [
      { label: "Badges PDF + QR", values: ["yes", "yes", "yes"] },
      { label: "Modèles personnalisés", values: ["no", "yes", "yes"] },
      { label: "Scanner mobile", values: ["yes", "yes", "yes"] },
    ],
  },
  {
    group: "Équipe & conformité",
    rows: [
      { label: "Rôles & permissions", values: ["Base", "Avancés", "Avancés"] },
      { label: "Journal d'activité", values: ["no", "yes", "yes"] },
      { label: "SSO / annuaire", values: ["no", "no", "yes"] },
      { label: "Support", values: ["E-mail", "Prioritaire", "Dédié + SLA"] },
    ],
  },
];

function CellView({ value }: { value: Cell }) {
  if (value === "yes")
    return (
      <span className="inline-flex text-green-600">
        <Icon name="check" size={16} />
      </span>
    );
  if (value === "no")
    return (
      <span className="inline-flex text-slate-300">
        <Icon name="minus" size={16} />
      </span>
    );
  return <span className="text-slate-700">{value}</span>;
}

export function ComparisonTable() {
  return (
    <div className="mt-[52px] overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-[13px] font-semibold text-slate-900">
            <th className="w-2/5 px-[18px] py-3.5 text-left">&nbsp;</th>
            <th className="px-[18px] py-3.5 text-center">Découverte</th>
            <th className="px-[18px] py-3.5 text-center">Pro</th>
            <th className="px-[18px] py-3.5 text-center">Entreprise</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {SECTIONS.map((section) => (
            <Fragment key={section.group}>
              <tr className="bg-slate-50">
                <td
                  colSpan={4}
                  className="px-[18px] py-3.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-slate-900"
                >
                  {section.group}
                </td>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.label} className="border-b border-slate-100">
                  <td className="px-[18px] py-3.5 text-slate-500">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-[18px] py-3.5 text-center">
                      <CellView value={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
