"use client";

import type { Permission } from "@/lib/permissions/catalog";
import { groupedPermissions, togglePermission } from "./logic";
import type { MatrixLevels } from "./types";

type Props = {
  levels: MatrixLevels;
  selected: ReadonlySet<Permission>;
  onChange?: (next: Set<Permission>) => void;
  readOnly?: boolean;
  /** Cases non modifiables, avec la raison affichée en infobulle. */
  disabled?: ReadonlyMap<Permission, string>;
};

// Cases groupées par domaine ; les permissions réservées ne sont jamais rendues.
export function PermissionMatrix({ levels, selected, onChange, readOnly = false, disabled }: Props) {
  const groups = groupedPermissions(levels);
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="permission-matrix">
      {groups.map((group) => (
        <fieldset key={group.domain} className="min-w-0 rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-navy">{group.label}</legend>
          <ul className="space-y-2.5">
            {group.permissions.map((def) => {
              const key = def.key as Permission;
              const reason = disabled?.get(key);
              const locked = readOnly || reason !== undefined;
              return (
                <li key={key}>
                  <label
                    title={reason}
                    className={`flex items-start gap-2.5 text-sm ${locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      name="permission"
                      value={key}
                      checked={selected.has(key)}
                      disabled={locked}
                      onChange={() => onChange?.(togglePermission(selected, key, disabled))}
                      className="mt-0.5 h-4 w-4 flex-none rounded border-slate-300 accent-navy"
                    />
                    <span className="min-w-0">
                      <span className="block break-words font-medium text-slate-900">{def.label}</span>
                      <span className="block break-words text-[12px] text-slate-400">{reason ?? def.description}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}
