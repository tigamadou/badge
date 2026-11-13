import type { UserPermissionOverride } from "@prisma/client";
import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import {
  PERMISSION_CATALOG,
  hasPermission,
  isPermission,
  permissionDef,
  permissionScopeOf,
  systemRolePermissions,
  type Permission,
  type PermissionScope,
} from "@/lib/permissions";
import { loadUserContext } from "@/lib/user-context";
import type { OrgMembershipLite, UserContext } from "@/types/auth";
import { RoleError } from "./errors";
import { heldOn } from "./held";

export type OverrideEffect = "GRANT" | "REVOKE";
export type OverrideInput = { permission: string; effect: OverrideEffect };
export type Override = { permission: Permission; effect: OverrideEffect };
export type OverridesDiff = {
  added: Override[];
  removed: Override[];
  changed: { permission: Permission; from: OverrideEffect; to: OverrideEffect }[];
};

/** Niveaux de permission ajustables : plateforme (dont participant) ou une organisation (ORG et EVENT). */
const PLATFORM_LEVEL_SCOPES: readonly PermissionScope[] = ["PLATFORM", "ORG", "EVENT", "PARTICIPANT"];
const ORG_LEVEL_SCOPES: readonly PermissionScope[] = ["ORG", "EVENT"];

const byCatalog = (a: { permission: Permission }, b: { permission: Permission }) =>
  PERMISSION_CATALOG.findIndex((p) => p.key === a.permission) - PERMISSION_CATALOG.findIndex((p) => p.key === b.permission);

function validateOverrides(orgId: string | null, desired: readonly OverrideInput[]): Map<Permission, OverrideEffect> {
  const allowed = orgId === null ? PLATFORM_LEVEL_SCOPES : ORG_LEVEL_SCOPES;
  const result = new Map<Permission, OverrideEffect>();
  for (const { permission, effect } of desired) {
    if (!isPermission(permission)) throw new RoleError("INVALID_PERMISSION", permission);
    if (permissionDef(permission).reserved) throw new RoleError("RESERVED_PERMISSION", permission);
    if (!allowed.includes(permissionScopeOf(permission))) throw new RoleError("INVALID_PERMISSION", permission);
    result.set(permission, effect);
  }
  return result;
}

/**
 * Remplace l'ensemble des ajustements d'un utilisateur à un niveau (`orgId` nul = plateforme).
 * Refus : soi-même, utilisateur inconnu ou non membre de l'organisation, autre OWNER (sauf
 * `users.permissions.manage`), permission réservée ou hors niveau, GRANT d'une permission non détenue.
 */
export async function applyOverrides(
  actor: UserContext,
  subjectUserId: string,
  orgId: string | null,
  desired: readonly OverrideInput[],
  req?: NextRequest,
): Promise<OverridesDiff> {
  if (actor.user.id === subjectUserId) throw new RoleError("SELF_MODIFICATION");
  const subject = await loadUserContext(subjectUserId);
  if (!subject) throw new RoleError("NOT_FOUND");
  if (orgId !== null) {
    const membership = subject.orgMemberships.find((m) => m.orgId === orgId);
    if (!membership) throw new RoleError("NOT_FOUND");
    if (membership.roleRef?.systemKey === "OWNER" && !hasPermission(actor, "users.permissions.manage", { kind: "platform" })) {
      throw new RoleError("OWNER_PROTECTED");
    }
  }

  const wanted = validateOverrides(orgId, desired);
  const rows = await prisma.userPermissionOverride.findMany({ where: { userId: subjectUserId, orgId } });
  const existing = new Map<string, UserPermissionOverride[]>();
  for (const row of rows) existing.set(row.permission, [...(existing.get(row.permission) ?? []), row]);

  const held = heldOn(actor, orgId === null ? { kind: "platform" } : { kind: "org", orgId });
  const diff: OverridesDiff = { added: [], removed: [], changed: [] };
  const dropIds: string[] = [];
  const updates: { id: string; effect: OverrideEffect }[] = [];

  for (const [permission, effect] of wanted) {
    const current = existing.get(permission)?.[0];
    if (current && current.effect === effect) continue;
    // Un GRANT nouveau ou modifié exige de détenir la permission (les droits participant s'accordent au niveau plateforme).
    if (effect === "GRANT" && permissionScopeOf(permission) !== "PARTICIPANT" && !held.has(permission)) {
      throw new RoleError("PERMISSION_NOT_HELD", permission);
    }
    if (current) {
      diff.changed.push({ permission, from: current.effect, to: effect });
      updates.push({ id: current.id, effect });
    } else {
      diff.added.push({ permission, effect });
    }
  }
  for (const [permission, list] of existing) {
    for (const extra of list.slice(1)) dropIds.push(extra.id);
    if (!wanted.has(permission as Permission)) {
      dropIds.push(list[0].id);
      diff.removed.push({ permission: permission as Permission, effect: list[0].effect });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.userPermissionOverride.deleteMany({ where: { id: { in: dropIds } } });
    for (const u of updates) await tx.userPermissionOverride.update({ where: { id: u.id }, data: { effect: u.effect } });
    await tx.userPermissionOverride.createMany({
      data: diff.added.map((o) => ({
        userId: subjectUserId,
        orgId,
        permission: o.permission,
        effect: o.effect,
        createdById: actor.user.id,
      })),
    });
  });

  diff.added.sort(byCatalog);
  diff.removed.sort(byCatalog);
  diff.changed.sort(byCatalog);
  if (diff.added.length + diff.removed.length + diff.changed.length > 0) {
    await logActivity({
      type: "USER_PERMISSIONS_CHANGED",
      userId: actor.user.id,
      targetId: subjectUserId,
      orgId: orgId ?? undefined,
      details: { level: orgId === null ? "platform" : "org", ...diff },
      req,
    });
  }
  return diff;
}

// ---------------------------------------------------------------------------------------------
//  Lecture : niveaux d'ajustement d'un utilisateur (hérité, ajustements, effectif)
// ---------------------------------------------------------------------------------------------

export type PermissionLevel = {
  target: { kind: "platform" } | { kind: "org"; orgId: string; orgName: string };
  role: { id: string | null; name: string; systemKey: string | null } | null;
  inherited: Permission[];
  overrides: Override[];
  effective: Permission[];
};

function applyLevel(base: ReadonlySet<Permission>, overrides: readonly Override[]): Set<Permission> {
  const result = new Set(base);
  for (const o of overrides) if (o.effect === "GRANT") result.add(o.permission);
  for (const o of overrides) if (o.effect === "REVOKE") result.delete(o.permission);
  return result;
}

const inCatalogOrder = (set: ReadonlySet<Permission>): Permission[] =>
  PERMISSION_CATALOG.filter((p) => set.has(p.key)).map((p) => p.key);

function roleSummary(role: { id: string | null; name: string; systemKey: string | null } | null) {
  return role ? { id: role.id, name: role.name, systemKey: role.systemKey } : null;
}

function platformLevel(ctx: UserContext): PermissionLevel {
  const base = new Set<Permission>(systemRolePermissions("PARTICIPANT"));
  if (ctx.isStaff && ctx.platformRole) for (const p of ctx.platformRole.permissions) base.add(p);
  const overrides = ctx.overrides.filter((o) => o.orgId === null);
  return {
    target: { kind: "platform" },
    role: ctx.isStaff ? roleSummary(ctx.platformRole) : null,
    inherited: inCatalogOrder(base),
    overrides: overrides.map((o) => ({ permission: o.permission, effect: o.effect })).sort(byCatalog),
    effective: inCatalogOrder(applyLevel(base, overrides)),
  };
}

function orgLevel(ctx: UserContext, membership: OrgMembershipLite, orgName: string): PermissionLevel {
  const orgId = membership.orgId;
  const orgScoped = (o: { permission: Permission }) => ORG_LEVEL_SCOPES.includes(permissionScopeOf(o.permission));
  const base = new Set<Permission>(membership.roleRef?.permissions ?? []);
  const inherited = applyLevel(base, ctx.overrides.filter((o) => o.orgId === null).filter(orgScoped));
  const overrides = ctx.overrides.filter((o) => o.orgId === orgId);
  return {
    target: { kind: "org", orgId, orgName },
    role: roleSummary(membership.roleRef),
    inherited: inCatalogOrder(inherited),
    overrides: overrides.map((o) => ({ permission: o.permission, effect: o.effect })).sort(byCatalog),
    effective: inCatalogOrder(applyLevel(inherited, overrides)),
  };
}

/** Niveau plateforme puis un niveau par organisation dont l'utilisateur est membre ; `null` si le compte n'existe pas. */
export async function loadPlatformLevels(userId: string): Promise<PermissionLevel[] | null> {
  const ctx = await loadUserContext(userId);
  if (!ctx) return null;
  const orgs = await prisma.organization.findMany({
    where: { id: { in: ctx.orgMemberships.map((m) => m.orgId) } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const levels = orgs.map((o) => orgLevel(ctx, ctx.orgMemberships.find((m) => m.orgId === o.id)!, o.name));
  return [platformLevel(ctx), ...levels];
}

/** Niveau d'une organisation ; `null` si le compte n'existe pas ou n'en est pas membre. */
export async function loadOrgLevel(userId: string, orgId: string): Promise<PermissionLevel | null> {
  const ctx = await loadUserContext(userId);
  if (!ctx) return null;
  const membership = ctx.orgMemberships.find((m) => m.orgId === orgId);
  if (!membership) return null;
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true } });
  return orgLevel(ctx, membership, org.name);
}
