import { SidebarNav, type NavEntry, type NavLink } from "@/components/admin/SidebarNav";
import { hasAnySettingsTab } from "@/lib/platform-settings-tabs";
import type { Permission } from "@/lib/permissions/catalog";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AppShell } from "@/components/layout/AppShell";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { SIDEBAR_BRAND, SIDEBAR_LINK, SIDEBAR_ROLE_LABEL } from "@/components/layout/sidebar-classes";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PageDocButton } from "@/components/page-docs/PageDocButton";

/**
 * Menu de l'espace plateforme : une entrée n'apparaît que si la permission de lecture correspondante est détenue ;
 * un groupe sans entrée visible disparaît.
 */
export function buildStaffNav(permissions: ReadonlySet<Permission>, pendingPrintRequests: number): NavEntry[] {
  const has = (p: Permission) => permissions.has(p);
  const link = (permission: Permission, entry: NavLink): NavLink[] => (has(permission) ? [entry] : []);
  const group = (label: string, entries: NavLink[]): NavEntry[] => (entries.length > 0 ? [{ group: label }, ...entries] : []);

  return [
    ...link("platform.access", { href: "/platform", label: "Tableau de bord", icon: "layout-dashboard", exact: true }),
    ...link("platform.access", { href: "/platform/notifications", label: "Notifications", icon: "bell" }),
    ...link("platform.access", { href: "/platform/docs", label: "Documentation", icon: "file" }),
    ...link("organizations.read", { href: "/platform/organizations", label: "Organisations", icon: "building-2" }),
    ...link("profiles.read", { href: "/platform/profiles", label: "Profils", icon: "user-check" }),
    ...link("plans.read", { href: "/platform/plans", label: "Plans", icon: "credit-card" }),
    ...link("payments.read", { href: "/platform/payments", label: "Paiements", icon: "file" }),
    ...link("users.read", { href: "/platform/users", label: "Utilisateurs", icon: "users" }),
    ...link("badge_templates.read", { href: "/platform/badge-templates", label: "Templates de badge", icon: "id-card" }),
    ...group("Impression", [
      ...link("print.requests.read", { href: "/platform/print/orders", label: "Commandes", icon: "inbox", count: pendingPrintRequests }),
      ...link("print.sheets.read", { href: "/platform/print/sheets", label: "Planches", icon: "printer" }),
      ...link("print.layouts.read", { href: "/platform/print/layouts", label: "Gabarits", icon: "layout-grid" }),
      ...link("print.catalog.read", { href: "/platform/print/catalog", label: "Catalogue", icon: "package" }),
    ]),
    ...group("Plateforme", [
      ...link("email_jobs.read", { href: "/platform/jobs", label: "Emails", icon: "mail" }),
      ...(hasAnySettingsTab(permissions)
        ? [{ href: "/platform/settings", label: "Paramètres", icon: "settings" } satisfies NavLink]
        : []),
      ...link("activity.read", { href: "/platform/activity", label: "Journal", icon: "scroll-text" }),
      ...link("platform.roles.manage", { href: "/platform/roles", label: "Rôles", icon: "shield" }),
    ]),
  ];
}

export function StaffShell({
  user,
  permissions,
  photoUrl,
  pendingPrintRequests,
  children,
}: {
  user: { name: string; email: string; roleName: string };
  // Permissions effectives (cible plateforme) : filtrent le menu.
  permissions: ReadonlySet<Permission>;
  photoUrl?: string | null;
  // Commandes d'impression envoyées, en attente de traitement (pastille du menu).
  pendingPrintRequests: number;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      sidebarHeader={
        <>
          <div className={SIDEBAR_BRAND}>Badge</div>
          {/* Le badge de rôle quitte l'en-tête sous sm : il est rappelé dans le tiroir */}
          <div className={SIDEBAR_ROLE_LABEL}>
            {user.roleName}
          </div>
        </>
      }
      sidebar={<SidebarNav items={buildStaffNav(permissions, pendingPrintRequests)} />}
      sidebarFooter={
        <LogoutButton className={`w-full ${SIDEBAR_LINK}`} />
      }
      header={
        <>
          <nav className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="truncate text-slate-500">Staff</span>
          </nav>
          <span className="hidden items-center gap-1.5 rounded-full bg-navy/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy sm:inline-flex">
            {user.roleName}
          </span>
          <PageDocButton />
          <NotificationBell scope={{ kind: "platform" }} />
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-600 sm:inline">{user.name}</span>
            <UserAvatar name={user.name} photoUrl={photoUrl ?? null} size={30} />
          </div>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
