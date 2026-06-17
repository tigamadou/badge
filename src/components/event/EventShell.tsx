import Link from "next/link";
import type { EffectiveEventRole } from "@/types/auth";

type Event = { id: string; title: string; slug: string; date: Date; archived: boolean; registrationOpen: boolean };
type Org = { id: string; name: string };

export function EventShell({
  org,
  event,
  effectiveRole,
  isStaffMode,
  user,
  children,
}: {
  org: Org;
  event: Event;
  effectiveRole: Exclude<EffectiveEventRole, null>;
  isStaffMode: boolean;
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const base = `/admin/${org.id}/events/${event.id}`;
  const nav = [
    { href: base, label: "Tableau de bord" },
    { href: `${base}/registrations`, label: "Inscriptions" },
    { href: `${base}/badges`, label: "Badges" },
    { href: `${base}/categories`, label: "Catégories" },
    { href: `${base}/members`, label: "Membres" },
    { href: `${base}/settings`, label: "Paramètres" },
    { href: `${base}/activity`, label: "Journal" },
    { href: `${base}/scan`, label: "Scanner" },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-gray-900 text-white p-4 flex flex-col">
        <Link href={`/admin/${org.id}/events`} className="text-xs text-gray-400 hover:underline">
          ← {org.name}
        </Link>
        <div className="text-lg font-bold mb-1 mt-2">{event.title}</div>
        <div className="text-xs text-gray-400 mb-6">
          {new Date(event.date).toLocaleDateString("fr-FR")}
          {event.archived && <span className="ml-2 px-2 py-0.5 rounded bg-gray-700 text-xs">Archivé</span>}
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="block rounded px-3 py-2 text-sm hover:bg-gray-800">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="text-xs text-gray-400 mt-auto pt-4 border-t border-gray-800">{user.name}</div>
      </aside>
      <div className="flex-1 flex flex-col">
        {isStaffMode && (
          <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-900">
            <strong>Mode staff</strong> — vos actions sont auditées et visibles par le OWNER.
          </div>
        )}
        <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {org.name} <span className="px-1 text-gray-300">/</span> Événement
            <span className="ml-3 px-2 py-0.5 rounded bg-gray-100 text-xs">{effectiveRole}</span>
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
