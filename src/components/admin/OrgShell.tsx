import Link from "next/link";
import { OrgSelector } from "./OrgSelector";
import { StaffBanner } from "./StaffBanner";

type Org = { id: string; name: string; slug: string };

export function OrgShell({
  org,
  user,
  orgs,
  isStaffMode,
  children,
}: {
  org: Org;
  user: { name: string; email: string; isStaff: boolean };
  orgs: Org[];
  isStaffMode: boolean;
  children: React.ReactNode;
}) {
  const nav = [
    { href: `/admin/${org.id}`, label: "Tableau de bord" },
    { href: `/admin/${org.id}/events`, label: "Événements" },
    { href: `/admin/${org.id}/members`, label: "Membres" },
    { href: `/admin/${org.id}/templates`, label: "Modèles catégories" },
    { href: `/admin/${org.id}/settings`, label: "Paramètres" },
    { href: `/admin/${org.id}/activity`, label: "Journal" },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-gray-900 text-white p-4 flex flex-col">
        <div className="text-lg font-bold mb-6">{org.name}</div>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded px-3 py-2 text-sm hover:bg-gray-800"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="text-xs text-gray-400 mt-auto pt-4 border-t border-gray-800">
          {user.name}
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        {isStaffMode && <StaffBanner orgName={org.name} />}
        <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-500">Espace organisation</div>
          <div className="flex items-center gap-4">
            <OrgSelector currentOrgId={org.id} orgs={orgs} isStaff={user.isStaff} />
            <Link href="/profile" className="text-sm text-gray-700 hover:underline">
              {user.email}
            </Link>
          </div>
        </header>
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
