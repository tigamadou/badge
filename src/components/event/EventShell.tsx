import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { EffectiveEventRole } from "@/types/auth";
import { AppShell } from "@/components/layout/AppShell";
import { SidebarNav, type NavEntry } from "@/components/admin/SidebarNav";
import { UserAvatar } from "@/components/layout/UserAvatar";
import {
  SHELL_BANNER,
  SIDEBAR_BRAND,
  SIDEBAR_CONTEXT_TITLE,
  SIDEBAR_FOOTER_TEXT,
} from "@/components/layout/sidebar-classes";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PageDocButton } from "@/components/page-docs/PageDocButton";

type Event = { id: string; title: string; slug: string; date: Date; archived: boolean; registrationOpen: boolean };
type Org = { id: string; name: string };

export function EventShell({
  org,
  event,
  effectiveRole,
  isStaffMode,
  printUnread = 0,
  user,
  photoUrl,
  children,
}: {
  org: Org;
  event: Event;
  effectiveRole: Exclude<EffectiveEventRole, null>;
  isStaffMode: boolean;
  // Commandes d'impression de l'évènement avec des messages non lus (0 : pastille masquée).
  printUnread?: number;
  user: { name: string; email: string };
  photoUrl?: string | null;
  children: React.ReactNode;
}) {
  const base = `/event/${event.id}`;
  const nav: NavEntry[] = [
    { href: base, label: "Tableau de bord", icon: "layout-dashboard", exact: true },
    { href: `${base}/notifications`, label: "Notifications", icon: "bell" },
    { href: `${base}/registrations`, label: "Inscriptions", icon: "user-check" },
    { href: `${base}/badges`, label: "Badges", icon: "id-card" },
    // Commandes d'impression : réservées à ceux qui détiennent la permission `print.request`.
    ...(effectiveRole === "ADMIN" || effectiveRole === "STAFF"
      ? [{ href: `${base}/print`, label: "Impression", icon: "printer", count: printUnread } as const]
      : []),
    { href: `${base}/categories`, label: "Catégories", icon: "tags" },
    { href: `${base}/scan`, label: "Scanner", icon: "scan-line" },
    { href: `${base}/members`, label: "Membres", icon: "users" },
    { group: "Administration" },
    { href: `${base}/settings`, label: "Paramètres", icon: "settings" },
    { href: `${base}/activity`, label: "Journal", icon: "scroll-text" },
    { href: `${base}/docs`, label: "Documentation", icon: "file" },
  ];

  return (
    <AppShell
      sidebarHeader={
        <>
          <div className={SIDEBAR_BRAND}>Badge</div>
          <div className="mb-3 px-2">
            <Link
              href={`/org/${org.id}/events`}
              className="mb-1.5 inline-flex items-center gap-1 text-xs text-nav-muted transition-colors hover:text-navy"
            >
              <ArrowLeft size={13} strokeWidth={1.5} /> {org.name}
            </Link>
            <div className={SIDEBAR_CONTEXT_TITLE}>{event.title}</div>
          </div>
        </>
      }
      sidebar={<SidebarNav items={nav} />}
      sidebarFooter={<div className={SIDEBAR_FOOTER_TEXT}>{user.email}</div>}
      banner={
        isStaffMode ? (
          <div className={`${SHELL_BANNER} sm:flex sm:items-center sm:gap-2.5 sm:px-5 sm:py-2.5`}>
            <strong className="font-semibold">Mode staff</strong>
            <span className="sm:hidden"> — actions auditées</span>
            <span className="hidden sm:inline">— vos actions sont auditées et visibles par le OWNER.</span>
          </div>
        ) : undefined
      }
      header={
        <>
          <nav className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="hidden text-slate-500 sm:inline">{org.name}</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span className="truncate font-medium text-slate-700">{event.title}</span>
          </nav>
          <span className="hidden items-center gap-1.5 rounded-full bg-navy/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-navy sm:inline-flex">
            {effectiveRole}
          </span>
          <PageDocButton />
          <NotificationBell scope={{ kind: "event", eventId: event.id }} />
          <UserAvatar name={user.name} photoUrl={photoUrl ?? null} size={30} />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
