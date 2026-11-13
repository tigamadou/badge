// Rôles système en base : lignes `Role` (sans `RolePermission`, les permissions restent dans le code).
import type { EventRole, OrgRole, PrismaClient, StaffRole } from "@prisma/client";
import { SYSTEM_ROLES, type SystemRoleKey } from "./system-roles";

/** Structurel : accepte le client de l'app comme celui d'un script ou d'un helper e2e. */
export type RoleDb = Pick<PrismaClient, "role">;

const KEYS = Object.keys(SYSTEM_ROLES) as SystemRoleKey[];

const LEGACY_KEYS: ReadonlySet<string> = new Set<StaffRole | OrgRole | EventRole>([
  "SUPER_ADMIN",
  "STAFF_ADMIN",
  "STAFF_SUPPORT",
  "STAFF_OBSERVER",
  "OWNER",
  "MANAGER",
  "AUDITOR",
  "ADMIN",
  "OPERATOR",
  "PRINTER",
  "VIEWER",
]);

/** Crée ou met à jour les 14 rôles système (upsert par `systemKey`) et renvoie leurs ids. */
export async function ensureSystemRoles(db: RoleDb): Promise<Record<SystemRoleKey, string>> {
  const ids = {} as Record<SystemRoleKey, string>;
  for (const key of KEYS) {
    const def = SYSTEM_ROLES[key];
    const row = await db.role.upsert({
      where: { systemKey: key },
      create: { systemKey: key, scope: def.scope, name: def.name, description: def.description },
      update: { name: def.name, description: def.description },
      select: { id: true },
    });
    ids[key] = row.id;
  }
  return ids;
}

export async function systemRoleId(db: RoleDb, key: SystemRoleKey): Promise<string> {
  const ids = await ensureSystemRoles(db);
  return ids[key];
}

/** Clé d'enum héritée (StaffRole, OrgRole, EventRole) d'un rôle système ; null pour les rôles sans enum. */
export function legacyKeyOf<T extends "StaffRole" | "OrgRole" | "EventRole" = "StaffRole" | "OrgRole" | "EventRole">(
  key: SystemRoleKey,
): (T extends "StaffRole" ? StaffRole : T extends "OrgRole" ? OrgRole : EventRole) | null {
  return LEGACY_KEYS.has(key) ? (key as never) : null;
}
