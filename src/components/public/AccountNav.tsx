"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  shortLabel?: string;
  hideBelowSm?: boolean;
  exact: boolean;
};

const ITEMS: Item[] = [
  { href: "/account", label: "Mes inscriptions", shortLabel: "Inscriptions", exact: true },
  { href: "/account/profile", label: "Profil", shortLabel: "Profil", exact: false },
  // Sous sm, la cloche donne déjà accès à la page : un libellé de plus ferait déborder l'en-tête.
  { href: "/account/notifications", label: "Notifications", hideBelowSm: true, exact: false },
  { href: "/account/docs", label: "Documentation", shortLabel: "Docs", exact: false },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="flex min-w-0 gap-0.5 overflow-x-auto text-xs sm:gap-1 sm:text-sm">
      {ITEMS.map((it) => {
        const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`${it.hideBelowSm ? "hidden sm:inline-flex " : ""}whitespace-nowrap rounded-lg px-1.5 py-1.5 font-medium sm:px-3 transition-colors ${
              active ? "bg-mist text-navy" : "text-slate-600 hover:text-navy"
            }`}
          >
            {it.shortLabel && <span className="sm:hidden">{it.shortLabel}</span>}
            <span className={it.shortLabel ? "hidden sm:inline" : undefined}>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
