import Link from "next/link";
import { OrgLogo } from "@/components/ui/PickCard";
import { Tag } from "@/components/ui/Labels";
import { Icon } from "@/components/ui/Icon";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  archived: boolean;
  _count: { events: number; memberships: number };
};

export function OrganizationsTable({ organizations }: { organizations: OrgRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">Organisation</th>
            <th className="px-4 py-3">Slug</th>
            <th className="px-4 py-3">Membres</th>
            <th className="px-4 py-3">Événements</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {organizations.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                Aucune organisation.
              </td>
            </tr>
          )}
          {organizations.map((o) => (
            <tr
              key={o.id}
              className={`border-t border-slate-100 hover:bg-slate-50 ${o.archived ? "opacity-60" : ""}`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <OrgLogo name={o.name} size={30} />
                  <Link
                    href={`/platform/organizations/${o.id}`}
                    className="text-sm font-medium text-slate-900 hover:text-green-600"
                  >
                    {o.name}
                  </Link>
                  {o.archived && <Tag icon="archive">Archivée</Tag>}
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-[13px] text-slate-400">{o.slug}</td>
              <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{o._count.memberships}</td>
              <td className="px-4 py-3 text-sm tabular-nums text-slate-600">{o._count.events}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/platform/organizations/${o.id}`}
                  aria-label={`Ouvrir ${o.name}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <Icon name="chevron-right" size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
