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

/** Permissions effectives : base (union des rôles) puis ajustements plateforme et d'organisation, filtrés par le niveau de la cible. */
export function effectivePermissions(ctx: UserContext, target: PermissionTarget): Set<Permission> {
  const scope = SCOPE_OF_TARGET[target.kind];
  const result = new Set<Permission>();
  const add = (perms: Iterable<Permission> | undefined) => {
    if (!perms) return;
    for (const p of perms) if (permissionScopeOf(p) === scope) result.add(p);
  };

  add(ctx.platformRole?.permissions);
  if (target.kind === "org" || target.kind === "event") {
    add(ctx.orgMemberships.find((m) => m.orgId === target.orgId)?.roleRef?.permissions);
  }
  if (target.kind === "event") {
    add(ctx.eventMemberships.find((m) => m.eventId === target.eventId)?.roleRef?.permissions);
  }
  if (target.kind === "participant") add(systemRolePermissions("PARTICIPANT"));

  const orgId = target.kind === "org" || target.kind === "event" ? target.orgId : null;
  const applicable = ctx.overrides.filter(
    (o) => permissionScopeOf(o.permission) === scope && (o.orgId === null || o.orgId === orgId),
  );
  // Plateforme avant organisation ; REVOKE appliqué après GRANT à chaque niveau.
  for (const level of [null, orgId]) {
    const rows = applicable.filter((o) => o.orgId === level);
    for (const o of rows) if (o.effect === "GRANT") result.add(o.permission);
    for (const o of rows) if (o.effect === "REVOKE") result.delete(o.permission);
  }
  return result;
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
