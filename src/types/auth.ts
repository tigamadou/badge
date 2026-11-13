import type { StaffRole, OrgRole, EventRole } from "@prisma/client";
import type { Permission } from "@/lib/permissions/catalog";
import type { RoleScope, SystemRoleKey } from "@/lib/permissions/system-roles";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
};

export type ResolvedRole = {
  /** null : rôle système résolu par repli sur l'enum */
  id: string | null;
  /** null : rôle personnalisé */
  systemKey: SystemRoleKey | null;
  scope: RoleScope;
  name: string;
  permissions: ReadonlySet<Permission>;
};

export type PermissionOverrideLite = {
  orgId: string | null;
  permission: Permission;
  effect: "GRANT" | "REVOKE";
};

export type OrgMembershipLite = {
  orgId: string;
  roleId: string | null;
  roleRef: ResolvedRole | null;
  /** @deprecated compat chantier roles-permissions (retiré à la fusion) */
  role: OrgRole | null;
};

export type EventMembershipLite = {
  eventId: string;
  roleId: string | null;
  roleRef: ResolvedRole | null;
  /** @deprecated compat chantier roles-permissions (retiré à la fusion) */
  role: EventRole | null;
};

export type UserContext = {
  user: { id: string; email: string; name: string };
  isStaff: boolean;
  platformRole: ResolvedRole | null;
  orgMemberships: OrgMembershipLite[];
  eventMemberships: EventMembershipLite[];
  overrides: PermissionOverrideLite[];
  /** @deprecated compat chantier roles-permissions (retiré à la fusion) : clé héritée, null pour STAFF_PRINTER/personnalisé */
  staffRole: StaffRole | null;
};

export type EffectiveEventRole = EventRole | "STAFF" | null;
