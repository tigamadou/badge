"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// v4 Bloc B : bandeau + sous-navigation de SUPERVISION staff d'une organisation.
// Rendu DANS le StaffShell (/platform/layout) : pas de second sidebar. Read-only,
// distinct de l'espace org (/org/[orgId]) reserve aux membres. Le staff ne "descend"
// plus dans les vues des membres.
export function PlatformOrgShell({
  org,
  canReadActivity = false,
  children,
}: {
  org: { id: string; name: string };
  canReadActivity?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/platform/organizations/${org.id}`;
  const tabs = [
    { href: base, label: "Fiche", exact: true },
    { href: `${base}/events`, label: "Événements" },
    { href: `${base}/members`, label: "Membres" },
    { href: `${base}/subscription`, label: "Abonnement" },
    ...(canReadActivity ? [{ href: `${base}/activity`, label: "Journal" }] : []),
  ];

  const isActive = (t: { href: string; exact?: boolean }) =>
    t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/platform/organizations" className="text-sm text-slate-500 hover:text-navy">
            ← Organisations
          </Link>
          <h1 className="text-xl font-semibold text-slate-800">{org.name}</h1>
        </div>
        <span className="inline-flex items-center rounded-full bg-warn-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warn">
          Supervision — lecture seule
        </span>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => {
          const active = isActive(t);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-navy font-medium text-navy"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
