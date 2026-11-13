// Migration des colonnes d'enum vers `roleId` (idempotente ; ne modifie jamais les colonnes d'enum).
import type { EventRole, OrgRole, PrismaClient, StaffRole } from "@prisma/client";
import { ensureSystemRoles } from "./db";

export type MigrateReport = { users: number; orgMemberships: number; eventMemberships: number; alreadyDone: number };

const STAFF_ROLES: StaffRole[] = ["SUPER_ADMIN", "STAFF_ADMIN", "STAFF_SUPPORT", "STAFF_OBSERVER"];
const ORG_ROLES: OrgRole[] = ["OWNER", "MANAGER", "AUDITOR"];
const EVENT_ROLES: EventRole[] = ["ADMIN", "OPERATOR", "PRINTER", "VIEWER"];

export async function migrateRoles(db: PrismaClient, opts: { dryRun?: boolean } = {}): Promise<MigrateReport> {
  const dryRun = opts.dryRun ?? false;
  return db.$transaction(async (tx) => {
    // Lignes déjà migrées avant l'appel.
    const alreadyDone =
      (await tx.user.count({ where: { platformRoleId: { not: null } } })) +
      (await tx.orgMembership.count({ where: { roleId: { not: null } } })) +
      (await tx.eventMembership.count({ where: { roleId: { not: null } } }));
    const report: MigrateReport = { users: 0, orgMemberships: 0, eventMemberships: 0, alreadyDone };
    // En simulation, rien n'est écrit (pas même les rôles système).
    const ids = dryRun ? null : await ensureSystemRoles(tx as unknown as PrismaClient);

    for (const key of STAFF_ROLES) {
      const where = { staffRole: key, platformRoleId: null };
      if (dryRun) report.users += await tx.user.count({ where });
      else report.users += (await tx.user.updateMany({ where, data: { platformRoleId: ids![key], isStaff: true } })).count;
    }
    for (const key of ORG_ROLES) {
      const where = { role: key, roleId: null };
      if (dryRun) report.orgMemberships += await tx.orgMembership.count({ where });
      else report.orgMemberships += (await tx.orgMembership.updateMany({ where, data: { roleId: ids![key] } })).count;
    }
    for (const key of EVENT_ROLES) {
      const where = { role: key, roleId: null };
      if (dryRun) report.eventMemberships += await tx.eventMembership.count({ where });
      else report.eventMemberships += (await tx.eventMembership.updateMany({ where, data: { roleId: ids![key] } })).count;
    }

    return report;
  });
}
