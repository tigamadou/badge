"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../ui/Icon";

export type { IconName };

export type NavLink = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  // Pastille à droite du libellé quand le compteur est positif (ex. demandes en attente).
  count?: number;
};
export type NavGroup = { group: string };
export type NavEntry = NavLink | NavGroup;

function isActive(pathname: string, link: NavLink): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(link.href + "/");
}

export function SidebarNav({ items }: { items: NavEntry[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((item, i) => {
        if ("group" in item) {
          return (
            <div
              key={`g-${i}`}
              className="px-2.5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/45"
            >
              {item.group}
            </div>
          );
        }
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg border-l-2 px-2.5 py-2 text-sm transition-colors ${
              active
                ? "border-green-400 bg-green-500/15 font-medium text-green-400"
                : "border-transparent text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon name={item.icon} size={18} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.count !== undefined && item.count > 0 ? (
              <span
                aria-label={`${item.count} en attente`}
                className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-[11px] font-semibold leading-5 text-white"
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
