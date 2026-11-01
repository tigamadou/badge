import type { StaffRole, OrgRole, EventRole } from "@prisma/client";
import type { UserContext, EffectiveEventRole } from "@/types/auth";

// Hierarchie lineaire staff : SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER.
const STAFF_ORDER: Record<StaffRole, number> = {
  STAFF_OBSERVER: 1,
  STAFF_SUPPORT: 2,
  STAFF_ADMIN: 3,
  SUPER_ADMIN: 4,
};

// Hierarchie lineaire org : OWNER > MANAGER > AUDITOR (decision 2026-05-31).
const ORG_ORDER: Record<OrgRole, number> = {
  AUDITOR: 1,
  MANAGER: 2,
  OWNER: 3,
};

// Permissions atomiques event (cf. spec docs/v2/features/multi-tenancy-rbac.md).
// La hierarchie event etant partielle (ADMIN > OPERATOR > { PRINTER, VIEWER }),
// les checks metier s'expriment par permission et non par "role minimum".
export type EventPermission =
  | "event.read.aggregated"
  | "event.read.detailed"
  | "registration.approve"
  | "registration.create"
  | "registration.delete"
  | "registration.export"
  | "registration.block"
  | "badge.print"
  | "scan.check-in"
  | "event.update"
  | "event.archive"
  | "event.registration_toggle"
  | "event.settings.update"
  | "event.categories.manage"
  | "event.members.manage"
  | "event.activity.read"
  | "print.request";

// Roles event qui satisfont chaque permission. Source : matrice "Niveau evenement"
// dans docs/v2/features/multi-tenancy-rbac.md. La table est exhaustive et inclut
// l'heritage interne (OPERATOR herite des lectures, ADMIN herite de tout).
const EVENT_PERMISSION_ROLES: Record<EventPermission, ReadonlyArray<EventRole>> = {
  "event.read.aggregated":     ["ADMIN", "OPERATOR", "VIEWER"],
  "event.read.detailed":       ["ADMIN", "OPERATOR"],
  "registration.approve":      ["ADMIN", "OPERATOR"],
  "registration.create":       ["ADMIN"],
  "registration.delete":       ["ADMIN"],
  "registration.export":       ["ADMIN"],
  "registration.block":        ["ADMIN"],
  "badge.print":               ["ADMIN", "OPERATOR", "PRINTER"],
  "scan.check-in":             ["ADMIN", "OPERATOR"],
  "event.update":              ["ADMIN"],
  "event.archive":             ["ADMIN"],
  "event.registration_toggle": ["ADMIN"],
  "event.settings.update":     ["ADMIN"],
  "event.categories.manage":   ["ADMIN"],
  "event.members.manage":      ["ADMIN"],
  "event.activity.read":       ["ADMIN"],
  "print.request":             ["ADMIN"],
};

export function staffRoleAtLeast(actual: StaffRole, required: StaffRole): boolean {
  return STAFF_ORDER[actual] >= STAFF_ORDER[required];
}

export function orgRoleAtLeast(actual: OrgRole, required: OrgRole): boolean {
  return ORG_ORDER[actual] >= ORG_ORDER[required];
}

// Verifie le niveau MINIMUM en suivant la chaine OWNER > MANAGER > AUDITOR.
// Un OWNER satisfait MANAGER et AUDITOR ; un MANAGER satisfait AUDITOR.
// Le staff n'obtient le role org QUE si `allowStaff` est explicitement demande
// (v4 Bloc B : le staff supervise via /platform, il ne "descend" plus dans /org).
// Les routes API metier passent { allowStaff: true } pour conserver le pouvoir staff ;
// le layout de pages /org appelle sans allowStaff pour rediriger le staff vers /platform.
export function hasOrgRole(
  ctx: UserContext,
  orgId: string,
  role: OrgRole,
  opts: { allowStaff?: boolean } = {},
): boolean {
  if (opts.allowStaff && ctx.isStaff) return true;
  return ctx.orgMemberships.some(
    (m) => m.orgId === orgId && orgRoleAtLeast(m.role, role),
  );
}

// Resout le role effectif d'un user sur un event en appliquant les heritages :
//   - staff (n'importe quel staffRole) => "STAFF"
//   - OWNER ou MANAGER de l'org parent => "ADMIN" (heritage symetrique)
//   - AUDITOR de l'org parent => "VIEWER" (lecture seule agregee)
//   - sinon, EventMembership explicite si presente
//   - null sinon
export function effectiveEventRole(
  ctx: UserContext,
  eventId: string,
  orgId: string,
): EffectiveEventRole {
  if (ctx.isStaff) return "STAFF";

  const orgMembership = ctx.orgMemberships.find((m) => m.orgId === orgId);
  if (orgMembership) {
    if (orgMembership.role === "OWNER" || orgMembership.role === "MANAGER") {
      return "ADMIN";
    }
    if (orgMembership.role === "AUDITOR") {
      return "VIEWER";
    }
  }

  const m = ctx.eventMemberships.find((x) => x.eventId === eventId);
  return m ? m.role : null;
}

// Verifie une permission atomique. Source de verite : EVENT_PERMISSION_ROLES.
// Staff bypass. L'heritage org est resolu via effectiveEventRole.
export function hasEventPermission(
  ctx: UserContext,
  eventId: string,
  orgId: string,
  permission: EventPermission,
): boolean {
  const eff = effectiveEventRole(ctx, eventId, orgId);
  if (eff === "STAFF") return true;
  if (eff === null) return false;
  return EVENT_PERMISSION_ROLES[permission].includes(eff);
}
