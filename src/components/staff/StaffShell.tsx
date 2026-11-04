import type { StaffRole } from "@prisma/client";
import { SidebarNav, type NavEntry } from "@/components/admin/SidebarNav";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { AppShell } from "@/components/layout/AppShell";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { SIDEBAR_BRAND, SIDEBAR_LINK, SIDEBAR_ROLE_LABEL } from "@/components/layout/sidebar-classes";
import { NotificationBell } from "@/components/notifications/NotificationBell";

function buildNav(pendingPrintRequests: number): NavEntry[] {
  return [
    { href: "/platform", label: "Tableau de bord", icon: "layout-dashboard", exact: true },
    { href: "/platform/notifications", label: "Notifications", icon: "bell" },
    { href: "/platform/organizations", label: "Organisations", icon: "building-2" },
    { href: "/platform/profiles", label: "Profils", icon: "user-check" },
    { href: "/platform/plans", label: "Plans", icon: "credit-card" },
    { href: "/platform/payments", label: "Paiements", icon: "file" },
    { href: "/platform/users", label: "Utilisateurs", icon: "users" },
    { href: "/platform/badge-templates", label: "Templates de badge", icon: "id-card" },
    { group: "Impression" },
    { href: "/platform/print/orders", label: "Commandes", icon: "inbox", count: pendingPrintRequests },
    { href: "/platform/print/sheets", label: "Planches", icon: "printer" },
    { href: "/platform/print/layouts", label: "Gabarits", icon: "layout-grid" },
    { href: "/platform/print/catalog", label: "Catalogue", icon: "package" },
    { group: "Plateforme" },
    { href: "/platform/jobs", label: "Emails", icon: "mail" },
    { href: "/platform/settings", label: "Paramètres", icon: "settings" },
    { href: "/platform/activity", label: "Journal", icon: "scroll-text" },
  ];
}

const ROLE_LABEL: Record<StaffRole, string> = {
  SUPER_ADMIN: "Super administrateur",
  STAFF_ADMIN: "Administrateur",
  STAFF_SUPPORT: "Support",
  STAFF_OBSERVER: "Observateur",
};

export function StaffShell({
  user,
  photoUrl,
  pendingPrintRequests,
  children,
}: {
  user: { name: string; email: string; staffRole: StaffRole };
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
            {ROLE_LABEL[user.staffRole]}
          </div>
        </>
      }
      sidebar={<SidebarNav items={buildNav(pendingPrintRequests)} />}
      sidebarFooter={
        <LogoutButton className={`w-full ${SIDEBAR_LINK}`} />
      }
      header={
        <>
          <nav className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="truncate text-slate-500">Staff</span>
          </nav>
          <span className="hidden items-center gap-1.5 rounded-full bg-navy/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy sm:inline-flex">
            {ROLE_LABEL[user.staffRole]}
          </span>
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
