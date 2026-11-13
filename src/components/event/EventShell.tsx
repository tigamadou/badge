import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Permission } from "@/lib/permissions";
import { AppShell } from "@/components/layout/AppShell";
import { SidebarNav } from "@/components/admin/SidebarNav";
import { eventNavFor } from "./event-nav";
import { UserAvatar } from "@/components/layout/UserAvatar";
import {
  SHELL_BANNER,
  SIDEBAR_BRAND,
  SIDEBAR_CONTEXT_TITLE,
  SIDEBAR_FOOTER_TEXT,
} from "@/components/layout/sidebar-classes";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PageDocButton } from "@/components/page-docs/PageDocButton";

type Event = { id: string; title: string; slug: string; date: Date; archived: boolean; registrationOpen: boolean };
type Org = { id: string; name: string };

export function EventShell({
  org,
  event,
  permissions,
  isStaffMode,
  printUnread = 0,
  orgLinkEnabled = true,
  user,
  photoUrl,
  children,
}: {
  org: Org;
  event: Event;
  permissions: Permission[];
  isStaffMode: boolean;
  // Commandes d'impression de l'évènement avec des messages non lus (0 : pastille masquée).
  printUnread?: number;
  // Faux quand l'utilisateur n'a pas d'espace d'organisation (membre d'évènement seul) : le lien devient un simple libellé.
  orgLinkEnabled?: boolean;
  user: { name: string; email: string };
  photoUrl?: string | null;
  children: React.ReactNode;
}) {
  // Menu filtre par permission (modele `event-nav.ts`), commun a tous les roles.
  const nav = eventNavFor(event.id, new Set(permissions), { printUnread });

  return (
    <AppShell
      sidebarHeader={
        <>
          <div className={SIDEBAR_BRAND}>Badge</div>
          <div className="mb-3 px-2">
            {orgLinkEnabled ? (
              <Link
                href={`/org/${org.id}/events`}
                className="mb-1.5 inline-flex items-center gap-1 text-xs text-nav-muted transition-colors hover:text-navy"
              >
                <ArrowLeft size={13} strokeWidth={1.5} /> {org.name}
              </Link>
            ) : (
              <div className="mb-1.5 text-xs text-nav-muted">{org.name}</div>
            )}
            <div className={SIDEBAR_CONTEXT_TITLE}>{event.title}</div>
          </div>
        </>
      }
      sidebar={<SidebarNav items={nav} />}
      sidebarFooter={<div className={SIDEBAR_FOOTER_TEXT}>{user.email}</div>}
      banner={
        isStaffMode ? (
          <div className={`${SHELL_BANNER} sm:flex sm:items-center sm:gap-2.5 sm:px-5 sm:py-2.5`}>
            <strong className="font-semibold">Mode staff</strong>
            <span className="sm:hidden"> — actions auditées</span>
            <span className="hidden sm:inline">— vos actions sont auditées et visibles par le OWNER.</span>
          </div>
        ) : undefined
      }
      header={
        <>
          <nav className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="hidden text-slate-500 sm:inline">{org.name}</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span className="truncate font-medium text-slate-700">{event.title}</span>
          </nav>
          <PageDocButton />
          <NotificationBell scope={{ kind: "event", eventId: event.id }} />
          <UserAvatar name={user.name} photoUrl={photoUrl ?? null} size={30} />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
