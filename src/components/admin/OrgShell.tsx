import type { OrgRole } from "@prisma/client";
import { OrgSelector } from "./OrgSelector";
import { SidebarNav, type NavEntry, type NavLink } from "./SidebarNav";
import { orgRoleAtLeast } from "@/lib/auth-helpers";
import { AppShell } from "@/components/layout/AppShell";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { UserAvatar } from "@/components/layout/UserAvatar";
import {
  SIDEBAR_BRAND,
  SIDEBAR_CONTEXT_TITLE,
  SIDEBAR_FOOTER_TEXT,
  SIDEBAR_LINK,
} from "@/components/layout/sidebar-classes";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PageDocButton } from "@/components/page-docs/PageDocButton";

type Org = { id: string; name: string; slug: string };

export function OrgShell({
  org,
  user,
  orgs,
  orgRole,
  photoUrl,
  children,
}: {
  org: Org;
  user: { name: string; email: string; isStaff: boolean };
  orgs: Org[];
  orgRole: OrgRole;
  photoUrl?: string | null;
  children: React.ReactNode;
}) {
  // v4 Bloc C : nav filtree par role effectif. AUDITOR (lecture seule) ne voit pas les
  // entrees d'ecriture ; MANAGER gere events/modeles/membres mais pas les parametres org ;
  // OWNER voit tout. L'enforcement reel reste route par route.
  const navByRole: Array<NavLink & { minRole: OrgRole }> = [
    { href: `/org/${org.id}`, label: "Tableau de bord", icon: "layout-dashboard", exact: true, minRole: "AUDITOR" },
    { href: `/org/${org.id}/notifications`, label: "Notifications", icon: "bell", minRole: "AUDITOR" },
    { href: `/org/${org.id}/events`, label: "Événements", icon: "calendar", minRole: "AUDITOR" },
    { href: `/org/${org.id}/members`, label: "Membres", icon: "users", minRole: "MANAGER" },
    { href: `/org/${org.id}/templates`, label: "Modèles catégories", icon: "tags", minRole: "MANAGER" },
    { href: `/org/${org.id}/subscription`, label: "Abonnement", icon: "credit-card", minRole: "MANAGER" },
    { href: `/org/${org.id}/payments`, label: "Paiements", icon: "file", minRole: "MANAGER" },
    { href: `/org/${org.id}/settings`, label: "Paramètres", icon: "settings", minRole: "OWNER" },
    { href: `/org/${org.id}/activity`, label: "Journal", icon: "scroll-text", minRole: "AUDITOR" },
    { href: `/org/${org.id}/docs`, label: "Documentation", icon: "file", minRole: "AUDITOR" },
  ];
  const nav: NavEntry[] = navByRole
    .filter((n) => orgRoleAtLeast(orgRole, n.minRole))
    .map(({ minRole: _minRole, ...link }) => link);

  return (
    <AppShell
      sidebarHeader={
        <>
          <div className={SIDEBAR_BRAND}>Badge</div>
          <div className={`${SIDEBAR_CONTEXT_TITLE} mb-1`}>{org.name}</div>
        </>
      }
      sidebar={<SidebarNav items={nav} />}
      sidebarFooter={
        <>
          <LogoutButton className={`w-full ${SIDEBAR_LINK}`} />
          <div className={SIDEBAR_FOOTER_TEXT}>{user.email}</div>
        </>
      }
      header={
        <>
          <nav className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="truncate font-medium text-slate-700">{org.name}</span>
          </nav>
          <OrgSelector currentOrgId={org.id} orgs={orgs} isStaff={user.isStaff} />
          <PageDocButton />
          <NotificationBell scope={{ kind: "org", orgId: org.id }} />
          <UserAvatar name={user.name} photoUrl={photoUrl ?? null} size={30} />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
