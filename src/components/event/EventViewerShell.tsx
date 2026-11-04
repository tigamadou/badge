import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { UserAvatar } from "@/components/layout/UserAvatar";
import {
  SIDEBAR_CONTEXT_MUTED,
  SIDEBAR_CONTEXT_TITLE,
  SIDEBAR_FOOTER_TEXT,
  SIDEBAR_LINK,
} from "@/components/layout/sidebar-classes";
import { NotificationBell } from "@/components/notifications/NotificationBell";

type Event = { id: string; title: string };
type Org = { id: string; name: string };

// ADR 2026-06-01 (v2-14 Task 4) : shell dedie VIEWER. Sidebar limitee a Overview
// (donnees agregees sans coordonnees) et Profil.
export function EventViewerShell({
  org,
  event,
  user,
  photoUrl,
  children,
}: {
  org: Org;
  event: Event;
  user: { name: string; email: string };
  photoUrl?: string | null;
  children: React.ReactNode;
}) {
  const base = `/event/${event.id}`;
  return (
    <AppShell
      sidebarHeader={
        <>
          <div className={SIDEBAR_CONTEXT_MUTED}>{org.name}</div>
          <div className={`${SIDEBAR_CONTEXT_TITLE} mb-3`}>{event.title}</div>
        </>
      }
      sidebar={
        <>
          <nav className="flex flex-1 flex-col gap-1">
            <Link
              href={`${base}/registrations/overview`}
              className={SIDEBAR_LINK}
            >
              Vue d&apos;ensemble
            </Link>
            <Link href={`${base}/notifications`} className={SIDEBAR_LINK}>
              Notifications
            </Link>
            <Link href="/profile" className={SIDEBAR_LINK}>
              Profil
            </Link>
          </nav>
        </>
      }
      sidebarFooter={<div className={SIDEBAR_FOOTER_TEXT}>{user.name}</div>}
      header={
        <>
          <div className="min-w-0 flex-1 truncate text-sm text-slate-500">
            Lecture — {event.title}
          </div>
          <Link href="/profile" className="hidden flex-none text-sm text-slate-700 hover:underline sm:inline">
            {user.email}
          </Link>
          <NotificationBell scope={{ kind: "event", eventId: event.id }} />
          <UserAvatar name={user.name} photoUrl={photoUrl ?? null} size={30} />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
