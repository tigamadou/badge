"use client";

import type { Permission } from "@/lib/permissions/catalog";
import { togglePermission } from "./logic";
import { PermissionSpaces, SwitchCells } from "./PermissionSpaces";
import type { MatrixLevels } from "./types";

type Props = {
  levels: MatrixLevels;
  selected: ReadonlySet<Permission>;
  onChange?: (next: Set<Permission>) => void;
  readOnly?: boolean;
  /** Interrupteurs non modifiables, avec la raison affichée en infobulle. */
  disabled?: ReadonlyMap<Permission, string>;
};

// Permissions d'un rôle : un interrupteur par permission, en onglets par espace.
export function PermissionMatrix({ levels, selected, onChange, readOnly = false, disabled }: Props) {
  return (
    <div data-testid="permission-matrix">
      <PermissionSpaces
        levels={levels}
        isActive={(key) => selected.has(key)}
        renderRow={(def) => {
          const key = def.key as Permission;
          const reason = disabled?.get(key);
          return (
            <SwitchCells
              def={def}
              checked={selected.has(key)}
              locked={readOnly || reason !== undefined}
              reason={reason}
              onToggle={() => onChange?.(togglePermission(selected, key, disabled))}
            />
          );
        }}
      />
    </div>
  );
}
