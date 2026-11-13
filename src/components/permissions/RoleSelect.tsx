import type { AssignableRoleRow } from "./types";

type Props = {
  roles: AssignableRoleRow[];
  value: string;
  onChange: (roleId: string) => void;
  name: string;
  label?: string;
  disabled?: boolean;
};

// Groupes « Rôles système » / « Rôles personnalisés » ; un rôle non attribuable est grisé avec sa raison.
export function RoleSelect({ roles, value, onChange, name, label = "Rôle", disabled }: Props) {
  const system = roles.filter((r) => r.systemKey !== null);
  const custom = roles.filter((r) => r.systemKey === null);
  const option = (r: AssignableRoleRow) => (
    <option key={r.id} value={r.id} disabled={!r.assignable} title={r.reason}>
      {r.name}
      {!r.assignable && r.reason ? ` (${r.reason})` : ""}
    </option>
  );
  return (
    <div className="mb-4">
      <label htmlFor={`${name}-select`} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={`${name}-select`}
        name={name}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
      >
        {value === "" ? <option value="">Choisir un rôle…</option> : null}
        {system.length > 0 ? <optgroup label="Rôles système">{system.map(option)}</optgroup> : null}
        {custom.length > 0 ? <optgroup label="Rôles personnalisés">{custom.map(option)}</optgroup> : null}
      </select>
    </div>
  );
}
