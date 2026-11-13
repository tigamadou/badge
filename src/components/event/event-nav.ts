import type { Permission } from "@/lib/permissions";
import type { NavEntry, NavLink } from "@/components/admin/SidebarNav";

export type EventNavSpec = {
  suffix: string;
  label: string;
  icon: NavLink["icon"];
  exact?: boolean;
  /** Visible dès que l'une de ces permissions est détenue ; liste vide : au moins une permission sur l'évènement. */
  anyOf: readonly Permission[];
  /** Masquée quand l'une de ces permissions est détenue (le contenu y est déjà présent ailleurs). */
  unlessAny?: readonly Permission[];
  group?: "Administration";
};

// Ordre du menu de l'évènement, lu aussi par l'atterrissage (`firstAllowedEventHref`) : menu et redirection ne divergent pas.
export const EVENT_NAV: readonly EventNavSpec[] = [
  { suffix: "", label: "Tableau de bord", icon: "layout-dashboard", exact: true, anyOf: ["event.read.aggregated", "event.read.detailed", "scan.check-in"] },
  { suffix: "/notifications", label: "Notifications", icon: "bell", anyOf: [] },
  { suffix: "/registrations/overview", label: "Vue d'ensemble", icon: "eye", anyOf: ["event.read.aggregated"], unlessAny: ["event.read.detailed"] },
  { suffix: "/registrations", label: "Inscriptions", icon: "user-check", anyOf: ["event.read.detailed"] },
  { suffix: "/badges", label: "Badges", icon: "id-card", anyOf: ["badge.print"] },
  { suffix: "/print", label: "Impression", icon: "printer", anyOf: ["print.request"] },
  { suffix: "/print/onsite", label: "Poste sur place", icon: "printer", anyOf: ["print.onsite.operate"] },
  { suffix: "/categories", label: "Catégories", icon: "tags", anyOf: ["event.read.detailed"] },
  { suffix: "/scan", label: "Scanner", icon: "scan-line", anyOf: ["scan.check-in"] },
  { suffix: "/members", label: "Membres", icon: "users", anyOf: ["event.members.manage"] },
  { suffix: "/docs", label: "Documentation", icon: "file", anyOf: [] },
  { suffix: "/settings", label: "Paramètres", icon: "settings", anyOf: ["event.settings.update"], group: "Administration" },
  { suffix: "/activity", label: "Journal", icon: "scroll-text", anyOf: ["event.activity.read", "scan.history.read"], group: "Administration" },
];

function visible(n: EventNavSpec, permissions: ReadonlySet<Permission>): boolean {
  if (n.unlessAny?.some((p) => permissions.has(p))) return false;
  if (n.anyOf.length === 0) return permissions.size > 0;
  return n.anyOf.some((p) => permissions.has(p));
}

function linkOf(eventId: string, n: EventNavSpec): NavLink {
  return {
    href: `/event/${eventId}${n.suffix}`,
    label: n.label,
    icon: n.icon,
    ...(n.exact ? { exact: true } : {}),
  };
}

export function eventNavFor(
  eventId: string,
  permissions: ReadonlySet<Permission>,
  extras: { printUnread?: number } = {},
): NavEntry[] {
  const entries: NavEntry[] = [];
  let groupOpen = false;
  for (const n of EVENT_NAV) {
    if (!visible(n, permissions)) continue;
    if (n.group && !groupOpen) {
      entries.push({ group: n.group });
      groupOpen = true;
    }
    const link = linkOf(eventId, n);
    if (n.suffix === "/print") link.count = extras.printUnread ?? 0;
    entries.push(link);
  }
  return entries;
}

/**
 * Première entrée autorisée (hors entrées « au moins une permission »). Une permission qu'aucune entrée
 * ne couvre (rôle personnalisé) replie sur Notifications, toujours accessible ; null sans aucune permission.
 */
export function firstAllowedEventHref(eventId: string, permissions: ReadonlySet<Permission>): string | null {
  const first = EVENT_NAV.find((n) => n.anyOf.length > 0 && visible(n, permissions));
  if (first) return linkOf(eventId, first).href;
  return permissions.size > 0 ? `/event/${eventId}/notifications` : null;
}
