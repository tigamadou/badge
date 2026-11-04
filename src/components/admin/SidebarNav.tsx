"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../ui/Icon";
import {
  SIDEBAR_COUNT,
  SIDEBAR_GROUP,
  SIDEBAR_LINK,
  SIDEBAR_LINK_ACTIVE,
} from "../layout/sidebar-classes";

export type { IconName };

export type NavLink = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  // Pastille à droite du libellé quand le compteur est positif (ex. commandes en attente).
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
            <div key={`g-${i}`} className={SIDEBAR_GROUP}>
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
            className={active ? SIDEBAR_LINK_ACTIVE : SIDEBAR_LINK}
          >
            <Icon name={item.icon} size={18} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.count !== undefined && item.count > 0 ? (
              <span aria-label={`${item.count} en attente`} className={SIDEBAR_COUNT}>
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
