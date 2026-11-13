import type { UserContext } from "@/types/auth";
import { permissionScopeOf, type Permission, type PermissionScope } from "./catalog";
import { systemRolePermissions } from "./system-roles";

export type PermissionTarget =
  | { kind: "platform" }
  | { kind: "org"; orgId: string }
  | { kind: "event"; eventId: string; orgId: string }
  | { kind: "participant" };

const SCOPE_OF_TARGET: Record<PermissionTarget["kind"], PermissionScope> = {
  platform: "PLATFORM",
  org: "ORG",
  event: "EVENT",
  participant: "PARTICIPANT",
};

/** Cible évènement d'une ressource portant `id` (évènement) ou `eventId` (ressource rattachée). */
export function eventTargetOf(r: { id: string; orgId: string } | { eventId: string; orgId: string }): Extract<PermissionTarget, { kind: "event" }> {
  return { kind: "event", eventId: "eventId" in r ? r.eventId : r.id, orgId: r.orgId };
}

function compute(ctx: UserContext, target: PermissionTarget, withStaffRights: boolean): Set<Permission> {
  const scope = SCOPE_OF_TARGET[target.kind];
  const result = new Set<Permission>();
  const add = (perms: Iterable<Permission> | undefined) => {
    if (!perms) return;
    for (const p of perms) if (permissionScopeOf(p) === scope) result.add(p);
  };

  if (withStaffRights) add(ctx.platformRole?.permissions);
  if (target.kind === "org" || target.kind === "event") {
    add(ctx.orgMemberships.find((m) => m.orgId === target.orgId)?.roleRef?.permissions);
  }
  if (target.kind === "event") {
    add(ctx.eventMemberships.find((m) => m.eventId === target.eventId)?.roleRef?.permissions);
  }
  if (target.kind === "participant") add(systemRolePermissions("PARTICIPANT"));

  const orgId = target.kind === "org" || target.kind === "event" ? target.orgId : null;
  // Droits « côté organisateur » d'un staff : ses GRANT plateforme sont écartés, ses REVOKE plateforme restent appliqués.
  const memberSideOfStaff = !withStaffRights && ctx.isStaff;
  const levels = [null, orgId];
  const applicable = ctx.overrides.filter(
    (o) => permissionScopeOf(o.permission) === scope && (o.orgId === null || o.orgId === orgId),
  );
  // Plateforme avant organisation ; REVOKE appliqué après GRANT à chaque niveau.
  for (const level of levels) {
    const rows = applicable.filter((o) => o.orgId === level);
    if (!(memberSideOfStaff && level === null)) {
      for (const o of rows) if (o.effect === "GRANT") result.add(o.permission);
    }
    for (const o of rows) if (o.effect === "REVOKE") result.delete(o.permission);
  }
  return result;
}

/**
 * Permissions effectives : base (union des rôles) puis ajustements plateforme et d'organisation, filtrés par le niveau de la cible.
 * Le rôle plateforme n'est pris en compte que pour un compte staff (`isStaff` = `platformRoleId` non nul).
 */
export function effectivePermissions(ctx: UserContext, target: PermissionTarget): Set<Permission> {
  return compute(ctx, target, ctx.isStaff);
}

/**
 * Droits « côté organisateur » : ensemble effectif calculé SANS le rôle plateforme ni les ajustements plateforme d'un staff
 * (rôles d'organisation et d'évènement, ajustements d'organisation). Pour un non-staff, égal à `effectivePermissions`.
 */
export function memberPermissions(ctx: UserContext, target: PermissionTarget): ReadonlySet<Permission> {
  return compute(ctx, target, false);
}

export function hasPermission(ctx: UserContext, permission: Permission, target: PermissionTarget): boolean {
  return effectivePermissions(ctx, target).has(permission);
}

/** Staff agissant sans appartenance à l'organisation ni à l'évènement visé. */
export function isStaffActor(ctx: UserContext, target: PermissionTarget): boolean {
  if (!ctx.isStaff) return false;
  if (target.kind === "org") return !ctx.orgMemberships.some((m) => m.orgId === target.orgId);
  if (target.kind === "event") {
    return (
      !ctx.orgMemberships.some((m) => m.orgId === target.orgId) &&
      !ctx.eventMemberships.some((m) => m.eventId === target.eventId)
    );
  }
  return false;
}
