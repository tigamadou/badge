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
  { href: "/admin/registrations", label: "Inscriptions", minRole: "MODERATEUR" },
  { href: "/admin/badges", label: "Badges", minRole: "MODERATEUR" },
  { href: "/scan", label: "Scanner", minRole: "OPERATOR" },
  { href: "/admin/categories", label: "Catégories", minRole: "MODERATEUR" },
  { href: "/admin/event", label: "Événement", minRole: "ADMIN" },
  { href: "/admin/settings", label: "Paramètres", minRole: "ADMIN" },
  { href: "/admin/users", label: "Utilisateurs", minRole: "SUPER_ADMIN" },
  { href: "/admin/activity-logs", label: "Journal d'activité", minRole: "ADMIN" },
];

const ROLE_HIERARCHY: Record<string, number> = {
  OPERATOR: 1,
  MODERATEUR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

interface SidebarProps {
  userRole: string;
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ userRole, mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[item.minRole] || 0)
  );

  const navContent = (
    <nav className="space-y-1">
      {visibleItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={`block px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive
                ? "bg-indigo-500/15 text-indigo-400 font-medium border-l-2 border-indigo-400"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 bg-slate-900 min-h-screen p-4">
        <h2 className="text-lg font-semibold text-white mb-8 px-2">Investiture</h2>
        {navContent}
      </aside>

      {/* Mobile full-screen overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm" />
          <div className="relative flex flex-col items-center justify-center h-full px-6">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
              aria-label="Fermer le menu"
            >
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-semibold text-white mb-10">Investiture</h2>
            <nav className="space-y-2 w-full max-w-xs">
              {visibleItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`block px-4 py-3 rounded-xl text-center text-base transition-colors ${
                      isActive
                        ? "bg-indigo-500/20 text-indigo-400 font-medium"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
