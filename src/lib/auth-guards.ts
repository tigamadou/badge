import { prisma } from "@/lib/prisma";
import { loadUserContext, getUserContext } from "@/lib/user-context";
import { effectivePermissions, hasPermission, eventTargetOf, memberPermissions, type Permission, type PermissionTarget } from "@/lib/permissions";

export class AuthError extends Error {
  constructor(
    public code:
      | "NOT_AUTHENTICATED"
      | "NOT_STAFF"
      | "EVENT_NOT_FOUND"
      | "PERMISSION_DENIED"
      | "LAST_OWNER"
      | "LAST_SUPER_ADMIN",
    public httpStatus: 401 | 403 | 404 | 409 = 403,
    message?: string,
  ) {
    super(message ?? code);
  }
}

// Garde par permission (spec 37). Une liste signifie "au moins une".
export async function requirePermission(
  userId: string,
  permission: Permission | readonly Permission[],
  target: PermissionTarget,
): Promise<void> {
  const ctx = await loadUserContext(userId);
  if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
  const list: readonly Permission[] = typeof permission === "string" ? [permission] : permission;
  if (!list.some((p) => hasPermission(ctx, p, target))) {
    throw new AuthError("PERMISSION_DENIED", 403);
  }
}

// Permissions effectives pour les Server Components (contexte memoise par requete).
export async function loadPermissions(userId: string, target: PermissionTarget): Promise<Set<Permission>> {
  const ctx = await getUserContext(userId);
  return ctx ? effectivePermissions(ctx, target) : new Set();
}

// Droits « côté organisateur » (sans le rôle plateforme d'un staff) ; ensemble vide si contexte nul.
export async function loadMemberPermissions(userId: string, target: PermissionTarget): Promise<ReadonlySet<Permission>> {
  const ctx = await loadUserContext(userId);
  return ctx ? memberPermissions(ctx, target) : new Set();
}

export async function loadEventTarget(
  eventId: string,
): Promise<Extract<PermissionTarget, { kind: "event" }>> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { orgId: true } });
  if (!event) throw new AuthError("EVENT_NOT_FOUND", 404);
  return eventTargetOf({ eventId, orgId: event.orgId });
}

// Garde-fou : refuse l'operation si elle retirerait le dernier OWNER actif
// d'une organisation non archivee. Ignore les users archives. Si l'org est elle-meme
// archivee, le garde-fou ne bloque pas (l'invariant ne s'applique qu'aux orgs vivantes).
export async function assertNotLastOwner(
  orgId: string,
  userIdBeingRemoved: string,
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { archived: true },
  });
  if (!org || org.archived) return;

  const remainingOwners = await prisma.orgMembership.count({
    where: {
      orgId,
      OR: [{ roleRef: { systemKey: "OWNER" } }, { roleId: null, role: "OWNER" }],
      userId: { not: userIdBeingRemoved },
      user: { archived: false },
    },
  });
  if (remainingOwners === 0) {
    throw new AuthError("LAST_OWNER", 409);
  }
}

// Garde-fou : refuse l'operation si elle retirerait le SUPER_ADMIN au dernier user
// qui le porte (au moins un SUPER_ADMIN actif doit exister en permanence).
export async function assertNotLastSuperAdmin(userIdBeingChanged: string): Promise<void> {
  const remaining = await prisma.user.count({
    where: {
      id: { not: userIdBeingChanged },
      isStaff: true,
      OR: [{ platformRole: { systemKey: "SUPER_ADMIN" } }, { platformRoleId: null, staffRole: "SUPER_ADMIN" }],
      archived: false,
    },
  });
  if (remaining === 0) {
    throw new AuthError("LAST_SUPER_ADMIN", 409);
  }
}
