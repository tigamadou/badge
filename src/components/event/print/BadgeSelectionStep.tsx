"use client";

import { useState } from "react";
import { RadioCards } from "@/components/ui/RadioCards";
import { Checkbox } from "@/components/ui/FormControls";
import { SearchInput } from "@/components/ui/Toolbar";
import {
  filterCandidates,
  isAvailable,
  selectedCandidates,
  type Candidate,
  type SelectionMode,
  type SelectionState,
} from "./selection";

const MODES = [
  { value: "ALL_AVAILABLE", title: "Tous les badges disponibles", description: "Toutes les inscriptions approuvées" },
  { value: "CATEGORIES", title: "Par catégorie", description: "Choisir une ou plusieurs catégories" },
  { value: "IDS", title: "Sélection manuelle", description: "Cocher les participants un par un" },
];

const MAX_ROWS = 200;

const toggle = (list: string[], id: string): string[] =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

// Étape « Badges » d'une commande en amont. Composant contrôlé : l'état vit dans l'assistant.
export function BadgeSelectionStep({
  candidates,
  state,
  onChange,
}: {
  candidates: Candidate[];
  state: SelectionState;
  onChange: (next: SelectionState) => void;
}) {
  const [query, setQuery] = useState("");
  const chosen = selectedCandidates(candidates, state);
  const categories = [
    ...new Map(candidates.map((c) => [c.categoryId, { name: c.categoryName, number: c.categoryNumber }])).entries(),
  ].sort((a, b) => a[1].number - b[1].number);
  const rows = filterCandidates(candidates, query);

  return (
    <div className="space-y-5">
      <RadioCards
        name="Mode de sélection des badges"
        options={MODES}
        value={state.mode}
        onChange={(mode) => onChange({ ...state, mode: mode as SelectionMode })}
      />

      {state.mode === "CATEGORIES" ? (
        <div className="space-y-2">
          {categories.map(([id, cat]) => {
            const count = candidates.filter((c) => c.categoryId === id && isAvailable(c)).length;
            return (
              <div key={id}>
                <Checkbox
                  checked={state.categoryIds.includes(id)}
                  onChange={() => onChange({ ...state, categoryIds: toggle(state.categoryIds, id) })}
                  label={`${cat.name} (${count} disponible${count > 1 ? "s" : ""})`}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {state.mode === "IDS" ? (
        <div>
          <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un participant ou une catégorie" />
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {rows.slice(0, MAX_ROWS).map((c) => {
              const reserved = c.reservedBy !== null;
              return (
                <li key={c.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 ${reserved ? "opacity-50" : ""}`}>
                  {reserved ? (
                    <span className="flex-1 text-sm text-slate-500">{`${c.firstName} ${c.lastName}`}</span>
                  ) : (
                    <div className="flex-1">
                      <Checkbox
                        checked={state.registrationIds.includes(c.id)}
                        onChange={() => onChange({ ...state, registrationIds: toggle(state.registrationIds, c.id) })}
                        label={`${c.firstName} ${c.lastName}`}
                      />
                    </div>
                  )}
                  <span className="text-xs text-slate-400">{c.categoryName}</span>
                  {c.printed ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      Déjà imprimé
                    </span>
                  ) : null}
                  {reserved ? <span className="text-xs text-slate-500">{`Déjà dans ${c.reservedBy}`}</span> : null}
                </li>
              );
            })}
            {rows.length === 0 ? <li className="px-4 py-6 text-center text-sm text-slate-400">Aucun résultat.</li> : null}
          </ul>
          {rows.length > MAX_ROWS ? (
            <p className="mt-1 text-xs text-slate-400">{`${MAX_ROWS} premiers résultats sur ${rows.length} : affinez la recherche.`}</p>
          ) : null}
        </div>
      ) : null}

      <p className="text-sm font-medium text-slate-700" aria-live="polite">
        {`${chosen.length} badge${chosen.length > 1 ? "s" : ""} sélectionné${chosen.length > 1 ? "s" : ""}`}
      </p>
    </div>
  );
}
