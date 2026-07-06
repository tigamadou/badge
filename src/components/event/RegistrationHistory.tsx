type Snapshot = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  structure: string;
  idDocumentNumber: string;
  createdAt: string;
};

export function RegistrationHistory({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length === 0) {
    return <p className="text-sm text-slate-500">Aucune modification antérieure.</p>;
  }
  return (
    <ul className="bg-white border rounded divide-y text-sm">
      {snapshots.map((s) => (
        <li key={s.id} className="px-4 py-3">
          <div className="flex justify-between">
            <span className="font-medium">
              {s.firstName} {s.lastName}
            </span>
            <span className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleString("fr-FR")}</span>
          </div>
          <div className="text-xs text-slate-600">
            {s.email} — {s.structure} — Doc {s.idDocumentNumber}
          </div>
        </li>
      ))}
    </ul>
  );
}
