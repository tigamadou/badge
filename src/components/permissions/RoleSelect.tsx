import type { AssignableRoleRow } from "./types";

type Props = {
  roles: AssignableRoleRow[];
  value: string;
  onChange: (roleId: string) => void;
  name: string;
  label?: string;
  disabled?: boolean;
  /** Sélecteur de ligne de tableau : pas d'étiquette visible ni de marge (le libellé reste l'étiquette accessible). */
  compact?: boolean;
};

// Groupes « Rôles système » / « Rôles personnalisés » ; un rôle non attribuable est grisé avec sa raison.
export function RoleSelect({ roles, value, onChange, name, label = "Rôle", disabled, compact = false }: Props) {
  const system = roles.filter((r) => r.systemKey !== null);
  const custom = roles.filter((r) => r.systemKey === null);
  const option = (r: AssignableRoleRow) => (
    <option key={r.id} value={r.id} disabled={!r.assignable} title={r.reason}>
      {r.name}
      {!r.assignable && r.reason ? ` (${r.reason})` : ""}
    </option>
  );
  return (
    <div className={compact ? "" : "mb-4"}>
      {compact ? null : (
        <label htmlFor={`${name}-select`} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        id={`${name}-select`}
        name={name}
        aria-label={compact ? label : undefined}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={
          compact
            ? "rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-50"
            : "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
        }
      >
        {value === "" ? <option value="">Choisir un rôle…</option> : null}
        {system.length > 0 ? <optgroup label="Rôles système">{system.map(option)}</optgroup> : null}
        {custom.length > 0 ? <optgroup label="Rôles personnalisés">{custom.map(option)}</optgroup> : null}
      </select>
    </div>
  );
}
