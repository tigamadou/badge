import type { StaffRole } from "@prisma/client";
import { SidebarNav, type NavEntry } from "@/components/admin/SidebarNav";
import { LogoutButton } from "@/components/auth/LogoutButton";

const NAV: NavEntry[] = [
  { href: "/platform", label: "Tableau de bord", icon: "layout-dashboard", exact: true },
  { href: "/platform/organizations", label: "Organisations", icon: "building-2" },
  { href: "/platform/plans", label: "Plans", icon: "credit-card" },
  { href: "/platform/users", label: "Utilisateurs", icon: "users" },
  { href: "/platform/settings", label: "Paramètres", icon: "settings" },
  { href: "/platform/activity", label: "Journal", icon: "scroll-text" },
];

const ROLE_LABEL: Record<StaffRole, string> = {
  SUPER_ADMIN: "Super administrateur",
  STAFF_ADMIN: "Administrateur",
  STAFF_SUPPORT: "Support",
  STAFF_OBSERVER: "Observateur",
};

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function StaffShell({
  user,
  children,
}: {
  user: { name: string; email: string; staffRole: StaffRole };
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-56 flex-none flex-col gap-1 bg-brand-navy px-3 py-4">
        <div className="mb-3 px-2 text-base font-semibold text-white">Badge</div>
        <SidebarNav items={NAV} />
        <div className="mt-auto pt-2">
          <LogoutButton className="flex w-full items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-none items-center gap-3 border-b border-slate-200 bg-white px-5">
          <nav className="flex flex-1 items-center gap-2 text-sm">
            <span className="text-slate-400">Staff</span>
          </nav>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-navy">
            {ROLE_LABEL[user.staffRole]}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">{user.name}</span>
            <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
              {initials(user.name)}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  );
}
