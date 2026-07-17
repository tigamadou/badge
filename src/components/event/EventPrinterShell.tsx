import Link from "next/link";

type Event = { id: string; title: string };
type Org = { id: string; name: string };

// ADR 2026-06-01 (v2-14 Task 4) : shell dedie PRINTER. Sidebar limitee a Badges et
// Profil -- conforme spec espace-evenement (PRINTER = responsable impression).
export function EventPrinterShell({
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
  const base = `/org/${org.id}/events/${event.id}`;
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-56 flex-none flex-col gap-1 bg-brand-navy px-3 py-4">
        <div className="px-2 text-xs text-slate-400">{org.name}</div>
        <div className="mb-3 px-2 text-sm font-semibold text-white">{event.title}</div>
        <nav className="flex flex-1 flex-col gap-1">
          <Link href={`${base}/badges`} className="flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
            Badges
          </Link>
          <Link href="/profile" className="flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
            Profil
          </Link>
        </nav>
        <div className="mt-auto truncate px-2 pt-2 text-xs text-slate-400">{user.name}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-none items-center justify-between border-b border-slate-200 bg-white px-5">
          <div className="text-sm text-slate-500">Impression — {event.title}</div>
          <Link href="/profile" className="text-sm text-slate-700 hover:underline">
            {user.email}
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  );
}
