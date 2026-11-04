"use client";

import { Icon } from "@/components/ui/Icon";
import { TemplatePreview } from "@/components/ui/TemplatePreview";
import type { TemplateSummary } from "@/components/admin/BadgeTemplatePicker";

type Props = {
  templates: TemplateSummary[];
  // null : l'evenement herite du template de l'organisation, puis de la plateforme.
  value: string | null;
  onChange: (id: string | null) => void;
  inheritedLabel: string;
};

const tileClass = (selected: boolean) =>
  `flex flex-col gap-3 rounded-xl border bg-white p-3 text-left transition-colors hover:border-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-navy ${
    selected ? "border-navy ring-1 ring-navy" : "border-slate-200"
  }`;

// Choix du template de badge sous forme de tuiles avec apercu, sans appel reseau :
// la valeur est portee par le parent (assistant de creation d'evenement).
export function BadgeTemplateTiles({ templates, value, onChange, inheritedLabel }: Props) {
  return (
    <div role="radiogroup" aria-label="Modèle de badge" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        data-testid="badge-tile-inherit"
        onClick={() => onChange(null)}
        className={tileClass(value === null)}
      >
        <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-mist">
          <span className="flex flex-col items-center gap-1 text-slate-400">
            <Icon name="id-card" size={28} />
            <span className="text-xs">Modèle hérité</span>
          </span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-navy">Hériter par défaut</h3>
          <p className="mt-1 text-xs text-slate-500">
            Utilise le modèle de l&apos;organisation, sinon celui de la plateforme : {inheritedLabel}.
          </p>
        </div>
      </button>

      {templates.map((tpl) => {
        const selected = value === tpl.id;
        return (
          <button
            key={tpl.id}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`badge-tile-${tpl.id}`}
            onClick={() => onChange(tpl.id)}
            className={tileClass(selected)}
          >
            <div className="pointer-events-none flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-mist">
              <TemplatePreview src={tpl.previewSrc} label={tpl.label} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-navy">{tpl.label}</h3>
                {tpl.onsite && (
                  <span role="img" aria-label="Impression sur place" title="Impression sur place" className="text-slate-500">
                    <Icon name="printer" size={14} />
                  </span>
                )}
                {selected && <Icon name="check" size={14} className="text-navy" />}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {tpl.pageSize.width} × {tpl.pageSize.height} · {tpl.pages} page{tpl.pages > 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-[13px] text-slate-600">{tpl.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
