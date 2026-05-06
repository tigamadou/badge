"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  minRole: string;
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", minRole: "OPERATOR" },
  { href: "/admin/registrations", label: "Inscriptions", minRole: "OPERATOR" },
  { href: "/scan", label: "Scanner", minRole: "OPERATOR" },
  { href: "/admin/scan-history", label: "Historique Scans", minRole: "OPERATOR" },
  { href: "/admin/categories", label: "Catégories", minRole: "ADMIN" },
  { href: "/admin/event", label: "Événement", minRole: "ADMIN" },
  { href: "/admin/users", label: "Utilisateurs", minRole: "SUPER_ADMIN" },
];

const ROLE_HIERARCHY: Record<string, number> = {
  OPERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[item.minRole] || 0)
  );

  return (
    <aside className="w-56 bg-gray-900 text-white min-h-screen p-4">
      <h2 className="text-lg font-bold mb-6 px-2">Investiture</h2>
      <nav className="space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded text-sm ${
                isActive ? "bg-gray-700 font-medium" : "hover:bg-gray-800"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
