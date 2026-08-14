import { prisma } from "@/lib/prisma";
import type { StaffRole, OrgRole, EventRole } from "@prisma/client";
import {
  staffRoleAtLeast,
  hasOrgRole,
  hasEventPermission,
  effectiveEventRole as effectiveEventRolePure,
  type EventPermission,
} from "@/lib/auth-helpers";
import { loadUserContext } from "@/lib/user-context";
import type { EffectiveEventRole } from "@/types/auth";

export class AuthError extends Error {
  constructor(
    public code:
      | "NOT_AUTHENTICATED"
      | "NOT_STAFF"
      | "INSUFFICIENT_STAFF_ROLE"
      | "ORG_FORBIDDEN"
      | "EVENT_FORBIDDEN"
      | "EVENT_NOT_FOUND"
      | "LAST_OWNER"
      | "LAST_SUPER_ADMIN",
    public httpStatus: 401 | 403 | 404 | 409 = 403,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export async function requireStaff(userId: string, minRole: StaffRole): Promise<void> {
  const ctx = await loadUserContext(userId);
  if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
  if (!ctx.isStaff || !ctx.staffRole) throw new AuthError("NOT_STAFF", 403);
  if (!staffRoleAtLeast(ctx.staffRole, minRole)) {
    throw new AuthError("INSUFFICIENT_STAFF_ROLE", 403);
  }
}

// Hierarchie lineaire OWNER > MANAGER > AUDITOR. hasOrgRole applique le niveau minimum
// (un OWNER satisfait MANAGER et AUDITOR ; un MANAGER satisfait AUDITOR).
export async function requireOrgRole(
  userId: string,
  orgId: string,
  role: OrgRole,
): Promise<void> {
  const ctx = await loadUserContext(userId);
  if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
  // Les routes API conservent le pouvoir d'action staff (audit staffActor cote metier).
  if (!hasOrgRole(ctx, orgId, role, { allowStaff: true })) {
    throw new AuthError("ORG_FORBIDDEN", 403);
  }
}

// Variante "role minimum" sur event, conservee pour les contextes UI/sidebar.
// La hierarchie event etant partielle (PRINTER et VIEWER disjoints), un user PRINTER
// ne satisfait PAS un check VIEWER (et inversement). Pour les checks metier API,
// preferer requireEventPermission.
export async function requireEventRole(
  userId: string,
  eventId: string,
  role: EventRole,
): Promise<void> {
  const ctx = await loadUserContext(userId);
  if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event) throw new AuthError("EVENT_NOT_FOUND", 404);

  const eff = effectiveEventRolePure(ctx, eventId, event.orgId);
  if (eff === "STAFF") return;
  if (eff === null) throw new AuthError("EVENT_FORBIDDEN", 403);

  // Verification stricte du role demande, en respectant la hierarchie partielle :
  //   ADMIN satisfait OPERATOR, PRINTER et VIEWER (englobe tous).
  //   OPERATOR satisfait PRINTER et VIEWER (englobe les deux sous-roles).
  //   PRINTER ne satisfait que PRINTER.
  //   VIEWER ne satisfait que VIEWER.
  const satisfied =
    eff === role ||
    (eff === "ADMIN") ||
    (eff === "OPERATOR" && (role === "PRINTER" || role === "VIEWER"));
  if (!satisfied) throw new AuthError("EVENT_FORBIDDEN", 403);
}

// Check par permission atomique : source de verite pour les routes API metier.
// Voir docs/v2/features/multi-tenancy-rbac.md > matrice "Niveau evenement".
export async function requireEventPermission(
  userId: string,
  eventId: string,
  permission: EventPermission,
): Promise<void> {
  const ctx = await loadUserContext(userId);
  if (!ctx) throw new AuthError("NOT_AUTHENTICATED", 401);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event) throw new AuthError("EVENT_NOT_FOUND", 404);
  if (!hasEventPermission(ctx, eventId, event.orgId, permission)) {
    throw new AuthError("EVENT_FORBIDDEN", 403);
  }
}

export async function getEffectiveEventRole(
  userId: string,
  eventId: string,
): Promise<EffectiveEventRole> {
  const ctx = await loadUserContext(userId);
  if (!ctx) return null;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event) return null;
  return effectiveEventRolePure(ctx, eventId, event.orgId);
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
      role: "OWNER",
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
      staffRole: "SUPER_ADMIN",
      archived: false,
    },
  });
  if (remaining === 0) {
    throw new AuthError("LAST_SUPER_ADMIN", 409);
  }
}
