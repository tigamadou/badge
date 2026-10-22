import type { OrgRole } from "@prisma/client";
import { OrgSelector } from "./OrgSelector";
import { SidebarNav, type NavEntry, type NavLink } from "./SidebarNav";
import { orgRoleAtLeast } from "@/lib/auth-helpers";
import { AppShell } from "@/components/layout/AppShell";
import { LogoutButton } from "@/components/auth/LogoutButton";

type Org = { id: string; name: string; slug: string };

function initials(name: string) {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function OrgShell({
  org,
  user,
  orgs,
  orgRole,
  children,
}: {
  org: Org;
  user: { name: string; email: string; isStaff: boolean };
  orgs: Org[];
  orgRole: OrgRole;
  children: React.ReactNode;
}) {
  // v4 Bloc C : nav filtree par role effectif. AUDITOR (lecture seule) ne voit pas les
  // entrees d'ecriture ; MANAGER gere events/modeles/membres mais pas les parametres org ;
  // OWNER voit tout. L'enforcement reel reste route par route.
  const navByRole: Array<NavLink & { minRole: OrgRole }> = [
    { href: `/org/${org.id}`, label: "Tableau de bord", icon: "layout-dashboard", exact: true, minRole: "AUDITOR" },
    { href: `/org/${org.id}/events`, label: "Événements", icon: "calendar", minRole: "AUDITOR" },
    { href: `/org/${org.id}/members`, label: "Membres", icon: "users", minRole: "MANAGER" },
    { href: `/org/${org.id}/templates`, label: "Modèles catégories", icon: "tags", minRole: "MANAGER" },
    { href: `/org/${org.id}/subscription`, label: "Abonnement", icon: "credit-card", minRole: "MANAGER" },
    { href: `/org/${org.id}/settings`, label: "Paramètres", icon: "settings", minRole: "OWNER" },
    { href: `/org/${org.id}/activity`, label: "Journal", icon: "scroll-text", minRole: "AUDITOR" },
  ];
  const nav: NavEntry[] = navByRole
    .filter((n) => orgRoleAtLeast(orgRole, n.minRole))
    .map(({ minRole: _minRole, ...link }) => link);

  return (
    <AppShell
      sidebarHeader={
        <>
          <div className="mb-1 px-2 text-base font-semibold text-white">Badge</div>
          <div className="mb-3 px-2 text-sm font-medium text-white/80">{org.name}</div>
        </>
      }
      sidebar={<SidebarNav items={nav} />}
      sidebarFooter={
        <>
          <LogoutButton className="flex w-full items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white" />
          <div className="px-2 text-xs text-slate-400 truncate">{user.email}</div>
        </>
      }
      header={
        <>
          <nav className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="truncate font-medium text-slate-700">{org.name}</span>
          </nav>
          <OrgSelector currentOrgId={org.id} orgs={orgs} isStaff={user.isStaff} />
          <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            {initials(user.name)}
          </span>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
