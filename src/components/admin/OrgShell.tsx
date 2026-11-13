import { OrgSelector } from "./OrgSelector";
import { SidebarNav } from "./SidebarNav";
import { orgNavFor } from "./org-nav";
import type { Permission } from "@/lib/permissions";
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
  permissions,
  photoUrl,
  children,
}: {
  org: Org;
  user: { name: string; email: string; isStaff: boolean };
  orgs: Org[];
  permissions: Permission[];
  photoUrl?: string | null;
  children: React.ReactNode;
}) {
  // Menu filtre par permission (modele `org-nav.ts`) ; l'application reelle des droits reste route par route.
  const nav = orgNavFor(org.id, new Set(permissions));

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
