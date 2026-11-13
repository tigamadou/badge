import type { Permission, PermissionScope } from "@/lib/permissions/catalog";
import type { RoleScope } from "@/lib/permissions/system-roles";

/** Rôle tel que renvoyé par les API de rôles (sans import Prisma côté client). */
export type RoleRow = {
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

/** Rôle proposé dans un sélecteur, avec son attribuabilité par l'acteur. */
export type AssignableRoleRow = {
  id: string;
  name: string;
  systemKey: string | null;
  scope: RoleScope;
  description: string | null;
  assignable: boolean;
  reason?: string;
};

export type OverrideEffect = "GRANT" | "REVOKE";
export type OverrideRow = { permission: Permission; effect: OverrideEffect };

/** Niveau d'ajustement d'un utilisateur (plateforme ou une organisation). */
export type PermissionLevelRow = {
  target: { kind: "platform" } | { kind: "org"; orgId: string; orgName: string };
  role: { id: string | null; name: string; systemKey: string | null } | null;
  inherited: Permission[];
  overrides: OverrideRow[];
  effective: Permission[];
};

export type MatrixLevels = readonly PermissionScope[];
