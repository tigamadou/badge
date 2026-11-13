"use client";

import { useState, type ReactNode } from "react";
import type { Permission, PermissionDef } from "@/lib/permissions/catalog";
import { permissionsBySpace } from "./logic";
import type { MatrixLevels } from "./types";

type Props = {
  levels: MatrixLevels;
  /** Permissions comptées comme actives dans les compteurs (onglets et domaines). */
  isActive: (key: Permission) => boolean;
  /** Contenu d'une ligne : deux cellules `<td>` (libellé, contrôle). */
  renderRow: (def: PermissionDef) => ReactNode;
};

const keysOf = (defs: readonly PermissionDef[]) => defs.map((d) => d.key as Permission);

// Un onglet par espace ; dans chacun, un tableau par domaine réparti en colonnes selon la largeur.
// Les onglets inactifs restent dans le DOM (masqués). Les permissions réservées ne sont jamais rendues.
export function PermissionSpaces({ levels, isActive, renderRow }: Props) {
  const spaces = permissionsBySpace(levels).map((space) => {
    const keys = space.groups.flatMap((g) => keysOf(g.permissions));
    return { ...space, active: keys.filter(isActive).length, total: keys.length };
  });
  const [current, setCurrent] = useState<string>(spaces[0]?.scope ?? "");
  return (
    <div>
      <div role="tablist" aria-label="Espaces" className="mb-4 flex flex-wrap gap-2">
        {spaces.map((space) => {
          const on = space.scope === current;
          return (
            <button
              key={space.scope}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setCurrent(space.scope)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                on ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {space.label}
              <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${on ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {`${space.active}/${space.total}`}
              </span>
            </button>
          );
        })}
      </div>
      {spaces.map((space) => (
        <div key={space.scope} role="tabpanel" aria-label={space.label} hidden={space.scope !== current} className="gap-4 [column-width:19rem]">
          {space.groups.map((group) => (
            <table
              key={group.domain}
              className="mb-4 w-full break-inside-avoid overflow-hidden rounded-lg border border-slate-200 bg-white text-sm"
            >
              <thead>
                <tr className="bg-navy">
                  <th scope="col" className="px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wider text-white">
                    {group.label}
                  </th>
                  <th scope="col" className="w-16 px-3 py-2 text-right text-[12px] font-normal tabular-nums text-white/70">
                    <span className="sr-only">Actives : </span>
                    {`${keysOf(group.permissions).filter(isActive).length}/${group.permissions.length}`}
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.permissions.map((def) => (
                  <tr key={def.key} className="border-b border-slate-100 last:border-b-0">
                    {renderRow(def)}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      ))}
    </div>
  );
}

type SwitchCellProps = {
  def: PermissionDef;
  checked: boolean;
  locked: boolean;
  /** Raison du blocage, affichée à la place de la description et en infobulle. */
  reason?: string;
  onToggle: () => void;
  /** Préfixe d'identifiant, quand plusieurs grilles coexistent dans la page. */
  idPrefix?: string;
};

const idOf = (key: string, prefix = "perm") => `${prefix}-${key.replace(/\./g, "-")}`;

/** Les deux cellules d'une ligne : libellé et description, puis l'interrupteur. */
export function SwitchCells({ def, checked, locked, reason, onToggle, idPrefix }: SwitchCellProps) {
  const id = idOf(def.key, idPrefix);
  return (
    <>
      <td className="px-3 py-2 align-top" title={reason}>
        <label htmlFor={id} className={`block break-words font-medium text-slate-900 ${locked ? "" : "cursor-pointer"}`}>
          {def.label}
        </label>
        <span id={`${id}-desc`} className="block break-words text-[12px] text-slate-400">
          {reason ?? def.description}
        </span>
      </td>
      <td className="px-3 py-2 text-right align-middle" title={reason}>
        <span className={`relative inline-flex ${locked ? "opacity-60" : ""}`}>
          <input
            id={id}
            type="checkbox"
            role="switch"
            name="permission"
            value={def.key}
            checked={checked}
            disabled={locked}
            aria-describedby={`${id}-desc`}
            onChange={onToggle}
            className={`peer absolute inset-0 z-10 h-full w-full appearance-none rounded-full ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
          />
          <span
            aria-hidden="true"
            className="relative h-[22px] w-[38px] flex-none rounded-full bg-slate-300 transition-colors peer-checked:bg-navy peer-focus-visible:ring-2 peer-focus-visible:ring-navy/40 peer-focus-visible:ring-offset-1 after:absolute after:left-0.5 after:top-0.5 after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"
          />
        </span>
      </td>
    </>
  );
}
