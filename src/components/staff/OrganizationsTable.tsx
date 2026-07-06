import Link from "next/link";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  archived: boolean;
  _count: { events: number; memberships: number };
};

export function OrganizationsTable({ organizations }: { organizations: OrgRow[] }) {
  return (
    <table className="w-full bg-white border rounded text-sm">
      <thead className="bg-slate-50 text-left">
        <tr>
          <th className="px-3 py-2">Nom</th>
          <th className="px-3 py-2">Slug</th>
          <th className="px-3 py-2">Events</th>
          <th className="px-3 py-2">Membres</th>
          <th className="px-3 py-2">Statut</th>
        </tr>
      </thead>
      <tbody>
        {organizations.length === 0 && (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
              Aucune organisation.
            </td>
          </tr>
        )}
        {organizations.map((o) => (
          <tr key={o.id} className="border-t">
            <td className="px-3 py-2">
              <Link
                href={`/staff/organizations/${o.id}`}
                className="text-green-600 hover:underline"
              >
                {o.name}
              </Link>
            </td>
            <td className="px-3 py-2 font-mono text-xs">{o.slug}</td>
            <td className="px-3 py-2">{o._count.events}</td>
            <td className="px-3 py-2">{o._count.memberships}</td>
            <td className="px-3 py-2">
              {o.archived ? (
                <span className="text-amber-700">Archivee</span>
              ) : (
                <span className="text-emerald-700">Active</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
