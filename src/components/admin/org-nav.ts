import type { Permission } from "@/lib/permissions";
import type { NavLink } from "./SidebarNav";

export type OrgNavSpec = {
  suffix: string;
  label: string;
  icon: NavLink["icon"];
  exact?: boolean;
  /** Visible dès que l'une de ces permissions est détenue. */
  anyOf: readonly Permission[];
};

// Ordre du menu de l'organisation. L'application réelle des droits reste route par route.
export const ORG_NAV: readonly OrgNavSpec[] = [
  { suffix: "", label: "Tableau de bord", icon: "layout-dashboard", exact: true, anyOf: ["org.read"] },
  { suffix: "/notifications", label: "Notifications", icon: "bell", anyOf: ["org.read"] },
  { suffix: "/events", label: "Événements", icon: "calendar", anyOf: ["org.events.list"] },
  { suffix: "/members", label: "Membres", icon: "users", anyOf: ["org.members.read"] },
  { suffix: "/roles", label: "Rôles", icon: "shield", anyOf: ["org.roles.manage"] },
  { suffix: "/templates", label: "Modèles catégories", icon: "tags", anyOf: ["org.templates.read"] },
  { suffix: "/subscription", label: "Abonnement", icon: "credit-card", anyOf: ["billing.subscription.read"] },
  { suffix: "/payments", label: "Paiements", icon: "file", anyOf: ["billing.payments.read"] },
  { suffix: "/settings", label: "Paramètres", icon: "settings", anyOf: ["org.update"] },
  { suffix: "/activity", label: "Journal", icon: "scroll-text", anyOf: ["org.activity.read"] },
  { suffix: "/docs", label: "Documentation", icon: "file", anyOf: ["org.read"] },
];

export function orgNavFor(orgId: string, permissions: ReadonlySet<Permission>): NavLink[] {
  return ORG_NAV.filter((n) => n.anyOf.some((p) => permissions.has(p))).map((n) => ({
    href: `/org/${orgId}${n.suffix}`,
    label: n.label,
    icon: n.icon,
    ...(n.exact ? { exact: true } : {}),
  }));
}
