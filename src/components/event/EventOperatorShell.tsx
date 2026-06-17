import Link from "next/link";

type Event = { id: string; title: string };
type Org = { id: string; name: string };

export function EventOperatorShell({
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
  const base = `/admin/${org.id}/events/${event.id}`;
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-gray-900 text-white p-4 flex flex-col">
        <div className="text-xs text-gray-400">{org.name}</div>
        <div className="text-lg font-bold mb-6 mt-2">{event.title}</div>
        <nav className="flex-1 space-y-1">
          <Link href={`${base}/scan`} className="block rounded px-3 py-2 text-sm hover:bg-gray-800">
            Scanner
          </Link>
          <Link href="/profile" className="block rounded px-3 py-2 text-sm hover:bg-gray-800">
            Profil
          </Link>
        </nav>
        <div className="text-xs text-gray-400 mt-auto pt-4 border-t border-gray-800">{user.name}</div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Opérateur — {event.title}
          </div>
          <Link href="/profile" className="text-sm text-gray-700 hover:underline">
            {user.email}
          </Link>
        </header>
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
