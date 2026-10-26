import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";

type Event = { id: string; title: string };
type Org = { id: string; name: string };

// ADR 2026-06-01 (v2-14 Task 4) : shell dedie PRINTER. Sidebar limitee a Badges et
// Profil -- conforme spec espace-evenement (PRINTER = responsable impression).
export function EventPrinterShell({
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
          <div className="px-2 text-xs text-slate-400">{org.name}</div>
          <div className="mb-3 px-2 text-sm font-semibold text-white">{event.title}</div>
        </>
      }
      sidebar={
        <>
          <nav className="flex flex-1 flex-col gap-1">
            <Link href={`${base}/badges`} className="flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              Badges
            </Link>
            <Link href={`${base}/notifications`} className="flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              Notifications
            </Link>
            <Link href="/profile" className="flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              Profil
            </Link>
          </nav>
        </>
      }
      sidebarFooter={<div className="truncate px-2 text-xs text-slate-400">{user.name}</div>}
      header={
        <>
          <div className="min-w-0 flex-1 truncate text-sm text-slate-500">
            Impression — {event.title}
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
