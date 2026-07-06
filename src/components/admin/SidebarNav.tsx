"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  ScrollText,
  Calendar,
  Tags,
  UserCheck,
  IdCard,
  ScanLine,
  type LucideIcon,
} from "lucide-react";

// Registre interne : les Server Components (shells) ne peuvent pas passer une
// fonction (composant icone) a travers la frontiere client. Ils passent donc
// un NOM serialisable, resolu ici cote client.
const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "building-2": Building2,
  users: Users,
  settings: Settings,
  "scroll-text": ScrollText,
  calendar: Calendar,
  tags: Tags,
  "user-check": UserCheck,
  "id-card": IdCard,
  "scan-line": ScanLine,
};

export type IconName = keyof typeof ICONS;

export type NavLink = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
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
        const Icon = ICONS[item.icon];
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
            {Icon ? <Icon size={18} strokeWidth={1.5} className="shrink-0" /> : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
