import type { Prisma, Role as RoleRow, RolePermission } from "@prisma/client";
import type { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import {
  PERMISSION_CATALOG,
  ROLE_SCOPE_ALLOWS,
  SYSTEM_ROLES,
  isPermission,
  isStaffActor,
  permissionDef,
  permissionScopeOf,
  type Permission,
  type PermissionTarget,
  type RoleScope,
} from "@/lib/permissions";
import { ensureSystemRoles } from "@/lib/permissions/db";
import type { UserContext } from "@/types/auth";
import { RoleError } from "./errors";
import { heldOn } from "./held";

/** Niveau auquel un rôle personnalisé est créé : plateforme, ou organisation / évènement d'une organisation. */
export type RoleLevel = { scope: "PLATFORM" } | { scope: "ORG" | "EVENT"; orgId: string };

/** Qui gère les rôles : la plateforme (rôles PLATFORM) ou une organisation (rôles ORG et EVENT de cette organisation). */
export type RoleOwner = { kind: "platform" } | { kind: "org"; orgId: string };

export type RoleDTO = {
  id: string;
  scope: RoleScope;
  systemKey: string | null;
  name: string;
  description: string | null;
  orgId: string | null;
  archived: boolean;
  permissions: Permission[];
  assignedCount?: number;
};

type RoleWithPermissions = RoleRow & { permissions: Pick<RolePermission, "permission">[] };

const WITH_PERMISSIONS = { permissions: { select: { permission: true } } } as const;

function catalogOrder(keys: Iterable<string>): Permission[] {
  const wanted = new Set(keys);
  return PERMISSION_CATALOG.filter((p) => wanted.has(p.key)).map((p) => p.key);
}

/** Permissions d'un rôle ; comme le résolveur, ignore les clés inconnues et les clés réservées d'un rôle personnalisé. */
function permissionsOf(row: RoleWithPermissions): Permission[] {
  if (row.systemKey !== null) return [...SYSTEM_ROLES[row.systemKey as keyof typeof SYSTEM_ROLES].permissions];
  return catalogOrder(
    row.permissions.map((p) => p.permission).filter((p) => isPermission(p) && !permissionDef(p).reserved),
  );
}

function toDTO(row: RoleWithPermissions, assignedCount?: number): RoleDTO {
  return {
    id: row.id,
    scope: row.scope,
    systemKey: row.systemKey,
    name: row.name,
    description: row.description,
    orgId: row.orgId,
    archived: row.archived,
    permissions: permissionsOf(row),
    ...(assignedCount === undefined ? {} : { assignedCount }),
  };
}

function levelOf(row: RoleRow): RoleLevel {
  return row.scope === "PLATFORM" ? { scope: "PLATFORM" } : { scope: row.scope as "ORG" | "EVENT", orgId: row.orgId! };
}

function ownerOrgId(level: RoleLevel): string | null {
  return level.scope === "PLATFORM" ? null : level.orgId;
}

function targetOf(level: RoleLevel): PermissionTarget {
  return level.scope === "PLATFORM" ? { kind: "platform" } : { kind: "org", orgId: level.orgId };
}

/** Nombre de comptes actifs portant chaque rôle (rôle plateforme, rôle d'organisation, rôle d'évènement). */
async function assignedCounts(roleIds: string[]): Promise<Map<string, number>> {
  const [users, orgs, events] = await Promise.all([
    prisma.user.groupBy({
      by: ["platformRoleId"],
      where: { archived: false, platformRoleId: { in: roleIds } },
      _count: { _all: true },
    }),
    prisma.orgMembership.groupBy({
      by: ["roleId"],
      where: { roleId: { in: roleIds }, user: { archived: false } },
      _count: { _all: true },
    }),
    prisma.eventMembership.groupBy({
      by: ["roleId"],
      where: { roleId: { in: roleIds }, user: { archived: false } },
      _count: { _all: true },
    }),
  ]);
  const counts = new Map<string, number>();
  const add = (id: string | null, n: number) => counts.set(id!, (counts.get(id!) ?? 0) + n);
  for (const r of users) add(r.platformRoleId, r._count._all);
  for (const r of orgs) add(r.roleId, r._count._all);
  for (const r of events) add(r.roleId, r._count._all);
  return counts;
}

/**
 * Valide les permissions demandées pour un rôle du niveau donné : clés connues, non réservées, portables
 * par ce niveau, et détenues par l'acteur (les clés de `keep`, déjà présentes sur le rôle, sont exemptées).
 */
export function validateRolePermissions(
  actor: UserContext,
  level: RoleLevel,
  keys: readonly string[],
  options: { keep?: ReadonlySet<string> } = {},
): Permission[] {
  const allowed = ROLE_SCOPE_ALLOWS[level.scope];
  const held = heldOn(actor, targetOf(level));
  const result = new Set<Permission>();
  for (const key of keys) {
    if (!isPermission(key)) throw new RoleError("INVALID_PERMISSION", key);
    if (permissionDef(key).reserved) throw new RoleError("RESERVED_PERMISSION", key);
    if (!allowed.includes(permissionScopeOf(key))) throw new RoleError("INVALID_PERMISSION", key);
    result.add(key);
  }
  for (const key of result) {
    if (!held.has(key) && !options.keep?.has(key)) throw new RoleError("PERMISSION_NOT_HELD", key);
  }
  return catalogOrder(result);
}

async function nameTaken(level: RoleLevel, name: string, excludeId?: string): Promise<boolean> {
  const lower = name.toLowerCase();
  if (Object.values(SYSTEM_ROLES).some((r) => r.scope === level.scope && r.name.toLowerCase() === lower)) return true;
  const clash = await prisma.role.findFirst({
    where: {
      scope: level.scope,
      orgId: ownerOrgId(level),
      systemKey: null,
      archived: false,
      name,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return clash !== null;
}

export async function createRole(
  actor: UserContext,
  level: RoleLevel,
  input: { name: string; description?: string | null; permissions: readonly string[] },
  req?: NextRequest,
): Promise<RoleDTO> {
  const permissions = validateRolePermissions(actor, level, input.permissions);
  const name = input.name.trim();
  if (await nameTaken(level, name)) throw new RoleError("ROLE_NAME_TAKEN");
  const row = await prisma.role.create({
    data: {
      scope: level.scope,
      orgId: ownerOrgId(level),
      name,
      description: input.description ?? null,
      createdById: actor.user.id,
      permissions: { create: permissions.map((permission) => ({ permission })) },
    },
    include: WITH_PERMISSIONS,
  });
  await logActivity({
    type: "ROLE_CREATED",
    userId: actor.user.id,
    targetId: row.id,
    orgId: row.orgId ?? undefined,
    details: { name, scope: row.scope, permissions },
    req,
  });
  return toDTO(row, 0);
}

/**
 * Charge un rôle dans le périmètre de `owner`. Un rôle absent, personnalisé d'un autre propriétaire ou
 * hors périmètre répond 404 (anti-IDOR) ; un rôle système est renvoyé tel quel (les écritures le refusent).
 */
async function loadManagedRole(roleId: string, owner: RoleOwner): Promise<RoleWithPermissions> {
  const row = await prisma.role.findUnique({ where: { id: roleId }, include: WITH_PERMISSIONS });
  if (!row) throw new RoleError("NOT_FOUND");
  if (row.systemKey !== null) {
    const visible = owner.kind === "platform" || row.scope === "ORG" || row.scope === "EVENT";
    if (!visible) throw new RoleError("NOT_FOUND");
    return row;
  }
  const mine =
    owner.kind === "platform" ? row.scope === "PLATFORM" && row.orgId === null : row.orgId === owner.orgId;
  if (!mine) throw new RoleError("NOT_FOUND");
  return row;
}

function assertCustom(row: RoleRow): void {
  if (row.systemKey !== null) throw new RoleError("SYSTEM_ROLE");
}

export async function getRole(roleId: string, owner: RoleOwner): Promise<RoleDTO> {
  const row = await loadManagedRole(roleId, owner);
  const counts = await assignedCounts([row.id]);
  return toDTO(row, counts.get(row.id) ?? 0);
}

export async function updateRole(
  actor: UserContext,
  owner: RoleOwner,
  roleId: string,
  patch: { name?: string; description?: string | null; permissions?: readonly string[] },
  req?: NextRequest,
): Promise<RoleDTO> {
  const row = await loadManagedRole(roleId, owner);
  assertCustom(row);
  const level = levelOf(row);
  const before = toDTO(row);

  const permissions =
    patch.permissions === undefined
      ? undefined
      : validateRolePermissions(actor, level, patch.permissions, { keep: new Set(before.permissions) });
  const name = patch.name?.trim();
  if (name !== undefined && (await nameTaken(level, name, row.id))) throw new RoleError("ROLE_NAME_TAKEN");

  const data: Prisma.RoleUpdateInput = {};
  if (name !== undefined) data.name = name;
  if (patch.description !== undefined) data.description = patch.description;
  const updated = await prisma.$transaction(async (tx) => {
    if (permissions !== undefined) {
      await tx.rolePermission.deleteMany({ where: { roleId: row.id } });
      await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: row.id, permission })) });
    }
    return tx.role.update({ where: { id: row.id }, data, include: WITH_PERMISSIONS });
  });
  const after = toDTO(updated);
  await logActivity({
    type: "ROLE_UPDATED",
    userId: actor.user.id,
    targetId: row.id,
    orgId: row.orgId ?? undefined,
    details: {
      before: { name: before.name, description: before.description, permissions: before.permissions },
      after: { name: after.name, description: after.description, permissions: after.permissions },
    },
    req,
  });
  const counts = await assignedCounts([row.id]);
  return { ...after, assignedCount: counts.get(row.id) ?? 0 };
}

export async function archiveRole(actor: UserContext, owner: RoleOwner, roleId: string, req?: NextRequest): Promise<RoleDTO> {
  const row = await loadManagedRole(roleId, owner);
  assertCustom(row);
  const counts = await assignedCounts([row.id]);
  if ((counts.get(row.id) ?? 0) > 0) throw new RoleError("ROLE_IN_USE");
  const updated = await prisma.role.update({
    where: { id: row.id },
    data: { archived: true, archivedAt: new Date() },
    include: WITH_PERMISSIONS,
  });
  await logActivity({
    type: "ROLE_ARCHIVED",
    userId: actor.user.id,
    targetId: row.id,
    orgId: row.orgId ?? undefined,
    details: { name: row.name },
    req,
  });
  return toDTO(updated, 0);
}

export async function restoreRole(actor: UserContext, owner: RoleOwner, roleId: string, req?: NextRequest): Promise<RoleDTO> {
  const row = await loadManagedRole(roleId, owner);
  assertCustom(row);
  if (await nameTaken(levelOf(row), row.name, row.id)) throw new RoleError("ROLE_NAME_TAKEN");
  const updated = await prisma.role.update({
    where: { id: row.id },
    data: { archived: false, archivedAt: null },
    include: WITH_PERMISSIONS,
  });
  await logActivity({
    type: "ROLE_RESTORED",
    userId: actor.user.id,
    targetId: row.id,
    orgId: row.orgId ?? undefined,
    details: { name: row.name },
    req,
  });
  return toDTO(updated, 0);
}

/**
 * Rôles d'un niveau : rôles système (permissions issues du code) puis rôles personnalisés du propriétaire
 * (`orgId` nul pour la plateforme), avec le nombre de comptes actifs qui les portent.
 */
export async function listRoles(
  scope: { scope: RoleScope; orgId?: string | null },
  options: { includeArchived?: boolean } = {},
): Promise<RoleDTO[]> {
  const systemKeys = Object.values(SYSTEM_ROLES)
    .filter((r) => r.scope === scope.scope)
    .map((r) => r.key);
  let system = await prisma.role.findMany({
    where: { systemKey: { in: systemKeys } },
    include: WITH_PERMISSIONS,
  });
  if (system.length < systemKeys.length) {
    await ensureSystemRoles(prisma);
    system = await prisma.role.findMany({ where: { systemKey: { in: systemKeys } }, include: WITH_PERMISSIONS });
  }
  system.sort((a, b) => systemKeys.indexOf(a.systemKey as never) - systemKeys.indexOf(b.systemKey as never));
  const custom = await prisma.role.findMany({
    where: {
      systemKey: null,
      scope: scope.scope,
      orgId: scope.orgId ?? null,
      ...(options.includeArchived ? {} : { archived: false }),
    },
    include: WITH_PERMISSIONS,
    orderBy: { name: "asc" },
  });
  const rows = [...system, ...custom];
  const counts = await assignedCounts(rows.map((r) => r.id));
  return rows.map((r) => toDTO(r, counts.get(r.id) ?? 0));
}

/**
 * Rôle attribuable à un compte ou à un membre : existant, non archivé, du bon niveau et, pour un rôle
 * personnalisé, de la bonne organisation. Absent, archivé ou d'une autre organisation : 404 ; niveau
 * incompatible : 400.
 */
export async function resolveAssignableRole(roleId: string, expected: RoleLevel): Promise<RoleDTO> {
  const row = await prisma.role.findUnique({ where: { id: roleId }, include: WITH_PERMISSIONS });
  if (!row || row.archived) throw new RoleError("NOT_FOUND");
  if (row.scope !== expected.scope) throw new RoleError("INVALID_ROLE");
  if (row.systemKey === null && row.orgId !== ownerOrgId(expected)) throw new RoleError("NOT_FOUND");
  return toDTO(row);
}

/**
 * Première permission du rôle que l'acteur ne détient pas sur la cible.
 * Exception : le staff qui agit sur une organisation ou un évènement sans en être membre (gestionnaire de
 * membres, sans les droits « côté client » : abonnement, devis) peut attribuer un rôle SYSTÈME, dont le contenu
 * est figé par le code. Les rôles personnalisés restent soumis à la règle stricte.
 */
export function missingPermission(
  actor: UserContext,
  role: Pick<RoleDTO, "permissions" | "systemKey">,
  target: PermissionTarget,
): Permission | undefined {
  if (role.systemKey !== null && target.kind !== "platform" && isStaffActor(actor, target)) return undefined;
  const held = heldOn(actor, target);
  return role.permissions.find((p) => !held.has(p));
}

/** Refuse l'attribution d'un rôle dont l'acteur ne détient pas toutes les permissions sur la cible. */
export function assertCanAssignRole(actor: UserContext, role: RoleDTO, target: PermissionTarget): void {
  const missing = missingPermission(actor, role, target);
  if (missing) throw new RoleError("PERMISSION_NOT_HELD", missing);
}

export type AssignableRole = Pick<RoleDTO, "id" | "name" | "systemKey" | "scope" | "description"> & {
  assignable: boolean;
  reason?: string;
};

/** Rôles proposables dans un sélecteur, avec leur attribuabilité par l'acteur (sans liste de permissions). */
export async function listAssignableRoles(
  actor: UserContext,
  scope: { scope: RoleScope; orgId?: string | null },
  target: PermissionTarget,
): Promise<AssignableRole[]> {
  const roles = await listRoles(scope);
  return roles.map((r) => {
    const missing = missingPermission(actor, r, target);
    const base = { id: r.id, name: r.name, systemKey: r.systemKey, scope: r.scope, description: r.description };
    return missing
      ? { ...base, assignable: false, reason: `Vous ne détenez pas la permission « ${permissionDef(missing).label} ».` }
      : { ...base, assignable: true };
  });
}
