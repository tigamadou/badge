import { OrgSelector } from "./OrgSelector";
import { StaffBanner } from "./StaffBanner";
import { SidebarNav, type NavEntry } from "./SidebarNav";

type Org = { id: string; name: string; slug: string };

function initials(name: string) {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

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
  const nav: NavEntry[] = [
    { href: `/admin/${org.id}`, label: "Tableau de bord", icon: "layout-dashboard", exact: true },
    { href: `/admin/${org.id}/events`, label: "Événements", icon: "calendar" },
    { href: `/admin/${org.id}/members`, label: "Membres", icon: "users" },
    { href: `/admin/${org.id}/templates`, label: "Modèles catégories", icon: "tags" },
    { href: `/admin/${org.id}/settings`, label: "Paramètres", icon: "settings" },
    { href: `/admin/${org.id}/activity`, label: "Journal", icon: "scroll-text" },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-56 flex-none flex-col gap-1 bg-brand-navy px-3 py-4">
        <div className="mb-1 px-2 text-base font-semibold text-white">Badge</div>
        <div className="mb-3 px-2 text-sm font-medium text-white/80">{org.name}</div>
        <SidebarNav items={nav} />
        <div className="mt-auto pt-2 px-2 text-xs text-slate-400 truncate">{user.email}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {isStaffMode && <StaffBanner orgName={org.name} />}
        <header className="flex h-14 flex-none items-center gap-3 border-b border-slate-200 bg-white px-5">
          <nav className="flex flex-1 items-center gap-2 text-sm">
            <span className="font-medium text-slate-700">{org.name}</span>
          </nav>
          <OrgSelector currentOrgId={org.id} orgs={orgs} isStaff={user.isStaff} />
          <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            {initials(user.name)}
          </span>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  );
}
