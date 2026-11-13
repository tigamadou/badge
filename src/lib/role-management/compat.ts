import type { EventRole, OrgRole, StaffRole } from "@prisma/client";
import { legacyKeyOf } from "@/lib/permissions/db";
import type { SystemRoleKey } from "@/lib/permissions";
import type { RoleDTO } from "./roles";

// @deprecated compat chantier roles-permissions (retiré à la fusion, plan 3) : double écriture de la colonne
// d'enum à côté de `roleId` / `platformRoleId`, tant que des lecteurs de l'enum subsistent.

type RoleKeyRef = Pick<RoleDTO, "id" | "systemKey">;

const legacy = <T extends "StaffRole" | "OrgRole" | "EventRole">(role: RoleKeyRef) =>
  role.systemKey === null ? null : legacyKeyOf<T>(role.systemKey as SystemRoleKey);

export const orgRoleColumns = (role: RoleKeyRef): { roleId: string; role: OrgRole | null } => ({
  roleId: role.id,
  role: legacy<"OrgRole">(role),
});

export const eventRoleColumns = (role: RoleKeyRef): { roleId: string; role: EventRole | null } => ({
  roleId: role.id,
  role: legacy<"EventRole">(role),
});

export const staffRoleColumns = (role: RoleKeyRef | null): { platformRoleId: string | null; staffRole: StaffRole | null; isStaff: boolean } =>
  role === null
    ? { platformRoleId: null, staffRole: null, isStaff: false }
    : { platformRoleId: role.id, staffRole: legacy<"StaffRole">(role), isStaff: true };

/** Valeur d'un rôle dans les détails du journal : clé du rôle système (stable, comme l'ancien enum), sinon le nom. */
export const roleLogKey = (role: { systemKey: string | null; name: string }): string => role.systemKey ?? role.name;
