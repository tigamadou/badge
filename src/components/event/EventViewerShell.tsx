import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";

type Event = { id: string; title: string };
type Org = { id: string; name: string };

// ADR 2026-06-01 (v2-14 Task 4) : shell dedie VIEWER. Sidebar limitee a Overview
// (donnees agregees sans coordonnees) et Profil.
export function EventViewerShell({
  org,
  event,
  user,
  children,
}: {
  org: Org;
  event: Event;
  user: { name: string; email: string };
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
            <Link
              href={`${base}/registrations/overview`}
              className="flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              Vue d&apos;ensemble
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
            Lecture — {event.title}
          </div>
          <Link href="/profile" className="hidden flex-none text-sm text-slate-700 hover:underline sm:inline">
            {user.email}
          </Link>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
