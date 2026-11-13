import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPermission, permissionDef, type Permission } from "@/lib/permissions/catalog";
import {
  SYSTEM_ROLES,
  isSystemRoleKey,
  systemRolePermissions,
  type RoleScope,
  type SystemRoleKey,
} from "@/lib/permissions/system-roles";
import type { ResolvedRole, UserContext } from "@/types/auth";

const ROLE_REF_SELECT = {
  id: true,
  systemKey: true,
  scope: true,
  name: true,
  archived: true,
  permissions: { select: { permission: true } },
} as const;

export const USER_CONTEXT_SELECT = {
  id: true,
  email: true,
  name: true,
  isStaff: true,
  archived: true,
  staffRole: true,
  platformRole: { select: ROLE_REF_SELECT },
  orgMemberships: { select: { orgId: true, role: true, roleId: true, roleRef: { select: ROLE_REF_SELECT } } },
  eventMemberships: { select: { eventId: true, role: true, roleId: true, roleRef: { select: ROLE_REF_SELECT } } },
  permissionOverrides: { select: { orgId: true, permission: true, effect: true } },
} satisfies Prisma.UserSelect;

type RoleRow = {
  id: string;
  systemKey: string | null;
  scope: RoleScope;
  name: string;
  archived: boolean;
  permissions: { permission: string }[];
};

function systemRole(key: SystemRoleKey, id: string | null): ResolvedRole {
  const def = SYSTEM_ROLES[key];
  return { id, systemKey: key, scope: def.scope, name: def.name, permissions: systemRolePermissions(key) };
}

type RolePlace = "PLATFORM" | "ORG" | "EVENT";

/** Permission interdite à un rôle personnalisé et à un ajustement (clé `reserved`). */
function isReserved(permission: Permission): boolean {
  return permissionDef(permission).reserved === true;
}

/**
 * `roleRef` non archivé d'abord ; sinon repli sur la colonne d'enum ; sinon aucun rôle (fermé par défaut).
 * Un rôle dont le niveau ne correspond pas à la place (membership d'organisation, d'évènement, plateforme) est ignoré,
 * ainsi que les clés `reserved` d'un rôle personnalisé.
 * Le repli sur la colonne d'enum (roleId nul) est conservé après la fusion (plan 3) : lignes créées avant la migration.
 */
function resolveRole(ref: RoleRow | null, legacyKey: string | null, place: RolePlace): ResolvedRole | null {
  if (ref) {
    if (ref.archived || ref.scope !== place) return null;
    if (ref.systemKey !== null && isSystemRoleKey(ref.systemKey)) return systemRole(ref.systemKey, ref.id);
    const permissions = new Set<Permission>();
    for (const { permission } of ref.permissions) {
      if (isPermission(permission) && !isReserved(permission)) permissions.add(permission);
    }
    return { id: ref.id, systemKey: null, scope: ref.scope, name: ref.name, permissions };
  }
  if (legacyKey !== null && isSystemRoleKey(legacyKey)) return systemRole(legacyKey, null);
  return null;
}

export function buildUserContext(row: Prisma.UserGetPayload<{ select: typeof USER_CONTEXT_SELECT }>): UserContext {
  const platformRole = resolveRole(row.platformRole, row.staffRole, "PLATFORM");

  const orgMemberships = row.orgMemberships.flatMap((m) => {
    const roleRef = resolveRole(m.roleRef, m.roleId === null ? m.role : null, "ORG");
    if (!roleRef && m.roleId === null && m.role === null) return [];
    return [{ orgId: m.orgId, roleId: m.roleId, roleRef }];
  });
  const eventMemberships = row.eventMemberships.flatMap((m) => {
    const roleRef = resolveRole(m.roleRef, m.roleId === null ? m.role : null, "EVENT");
    if (!roleRef && m.roleId === null && m.role === null) return [];
    return [{ eventId: m.eventId, roleId: m.roleId, roleRef }];
  });

  const overrides = row.permissionOverrides.flatMap((o) =>
    isPermission(o.permission) && !isReserved(o.permission) ? [{ orgId: o.orgId, permission: o.permission, effect: o.effect }] : [],
  );

  return {
    user: { id: row.id, email: row.email, name: row.name },
    isStaff: row.isStaff,
    platformRole,
    orgMemberships,
    eventMemberships,
    overrides,
  };
}

// Non mémoïsé : une route qui modifie un rôle puis relit ne doit pas voir un contexte périmé.
export async function loadUserContext(userId: string): Promise<UserContext | null> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: USER_CONTEXT_SELECT });
  if (!row || row.archived) return null;
  return buildUserContext(row);
}

// Mis en cache par requête (pages, loadPermissions).
export const getUserContext = cache(loadUserContext);
