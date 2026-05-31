import Link from "next/link";
import type { StaffRole } from "@prisma/client";

type Nav = { href: string; label: string };

const NAV: Nav[] = [
  { href: "/staff", label: "Tableau de bord" },
  { href: "/staff/organizations", label: "Organisations" },
  { href: "/staff/users", label: "Utilisateurs" },
  { href: "/staff/settings", label: "Parametres" },
  { href: "/staff/activity", label: "Journal" },
];

// Hierarchie complete avec SUPER_ADMIN au sommet (decision 2026-05-31).
const ROLE_LABEL: Record<StaffRole, string> = {
  SUPER_ADMIN: "Super administrateur",
  STAFF_ADMIN: "Administrateur",
  STAFF_SUPPORT: "Support",
  STAFF_OBSERVER: "Observateur",
};

export function StaffShell({
  user,
  children,
}: {
  user: { name: string; email: string; staffRole: StaffRole };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-slate-900 text-white p-4 flex flex-col">
        <div className="text-lg font-bold mb-6">Badge — Staff</div>
        <nav className="flex-1 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded px-3 py-2 text-sm hover:bg-slate-800"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="text-xs text-slate-400 mt-auto pt-4 border-t border-slate-800">
          <div className="font-medium text-slate-200">{user.name}</div>
          <div className="truncate">{user.email}</div>
          <div className="mt-1 inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            {ROLE_LABEL[user.staffRole]}
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-slate-500">Espace staff applicatif</div>
          <Link href="/profile" className="text-sm text-slate-700 hover:underline">
            Mon profil
          </Link>
        </header>
        <main className="flex-1 p-6 bg-slate-50">{children}</main>
      </div>
    </div>
  );
}
