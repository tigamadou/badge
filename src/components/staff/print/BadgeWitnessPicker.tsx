"use client";

import { useId, useState } from "react";
import { parseMm, type TemplateOption } from "./layout-form";

export type BadgeWitness = {
  templateId: string;
  setTemplateId: (id: string) => void;
  freeW: string;
  setFreeW: (v: string) => void;
  freeH: string;
  setFreeH: (v: string) => void;
  selected: TemplateOption | null;
  badgeMm: { width: number; height: number } | null;
};

// Badge témoin : "free" = taille libre, sinon id de template installé.
export function useBadgeWitness(templates: TemplateOption[]): BadgeWitness {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "free");
  const [freeW, setFreeW] = useState("84");
  const [freeH, setFreeH] = useState("120");

  const selected = templates.find((t) => t.id === templateId) ?? null;
  let badgeMm: BadgeWitness["badgeMm"] = null;
  if (templateId === "free") {
    const w = parseMm(freeW);
    const h = parseMm(freeH);
    badgeMm = w && h && w > 0 && h > 0 ? { width: w, height: h } : null;
  } else if (selected) {
    badgeMm = { width: selected.widthMm, height: selected.heightMm };
  }
  return { templateId, setTemplateId, freeW, setFreeW, freeH, setFreeH, selected, badgeMm };
}

const TONE = {
  light: {
    label: "text-slate-700",
    field: "border-slate-300 bg-white text-slate-900 focus:ring-green-500",
    hint: "text-slate-500",
    duplex: "bg-green-100 text-green-700",
    single: "bg-slate-100 text-slate-600",
  },
  dark: {
    label: "text-white/70",
    field: "border-white/15 bg-white/5 text-white focus:ring-green-400 [&>option]:text-slate-900",
    hint: "text-white/50",
    duplex: "bg-green-400/15 text-green-300",
    single: "bg-white/10 text-white/70",
  },
};

// Sélecteur du badge témoin. Le <label> précède directement son champ (structure ciblée par les e2e).
export function BadgeWitnessPicker({
  witness,
  templates,
  tone = "light",
}: {
  witness: BadgeWitness;
  templates: TemplateOption[];
  tone?: "light" | "dark";
}) {
  const id = useId();
  const c = TONE[tone];
  const field = `w-full rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 ${c.field}`;
  const { selected } = witness;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor={id} className={`mb-1 block text-xs font-medium uppercase tracking-wider ${c.label}`}>
            Template installé
          </label>
          <select
            id={id}
            className={field}
            value={witness.templateId}
            onChange={(e) => witness.setTemplateId(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {`${t.label} (${t.widthMm.toFixed(1)} × ${t.heightMm.toFixed(1)} mm)${t.pages === 2 ? " · recto-verso" : ""}`}
              </option>
            ))}
            <option value="free">Taille libre</option>
          </select>
        </div>
        {witness.templateId === "free" && (
          <>
            <div className="w-28">
              <label htmlFor={`${id}-w`} className={`mb-1 block text-xs font-medium ${c.label}`}>
                Largeur du badge (mm)
              </label>
              <input
                id={`${id}-w`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                className={field}
                value={witness.freeW}
                onChange={(e) => witness.setFreeW(e.target.value)}
              />
            </div>
            <div className="w-28">
              <label htmlFor={`${id}-h`} className={`mb-1 block text-xs font-medium ${c.label}`}>
                Hauteur du badge (mm)
              </label>
              <input
                id={`${id}-h`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                className={field}
                value={witness.freeH}
                onChange={(e) => witness.setFreeH(e.target.value)}
              />
            </div>
          </>
        )}
      </div>
      {selected && (
        <p className={`flex flex-wrap items-center gap-2 text-sm ${c.hint}`}>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
              selected.pages === 2 ? c.duplex : c.single
            }`}
          >
            {selected.pages === 2 ? "Recto-verso" : "Recto seul"}
          </span>
          {selected.pages === 2
            ? "Chaque verso est placé derrière son recto, selon le retournement du gabarit."
            : "Ce template n'a qu'une face : pas d'impression recto-verso."}
        </p>
      )}
    </div>
  );
}
