"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/account", label: "Mes inscriptions", exact: true },
  { href: "/account/profile", label: "Profil", exact: false },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {ITEMS.map((it) => {
        const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              active ? "bg-green-500/15 text-green-700" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
