import { PERMISSION_CATALOG, type Permission, type PermissionDef } from "@/lib/permissions/catalog";
import { groupByDomain } from "@/lib/permissions/labels";
import { ActionError } from "@/lib/toast";
import type { AssignableRoleRow, MatrixLevels, OverrideEffect, OverrideRow } from "./types";

/** Permissions proposées à l'édition : celles des niveaux demandés, jamais les clés réservées. */
export function editablePermissions(levels: MatrixLevels): Permission[] {
  return (PERMISSION_CATALOG as readonly PermissionDef[])
    .filter((p) => levels.includes(p.scope) && !p.reserved)
    .map((p) => p.key as Permission);
}

export function groupedPermissions(levels: MatrixLevels) {
  return groupByDomain(editablePermissions(levels));
}

/** Bascule une permission ; une permission désactivée ne change jamais la sélection. */
export function togglePermission(
  selected: ReadonlySet<Permission>,
  key: Permission,
  disabled: ReadonlyMap<Permission, string> | undefined,
): Set<Permission> {
  const next = new Set(selected);
  if (disabled?.has(key)) return next;
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export type OverrideState = "inherited" | "granted" | "revoked";

export function stateOf(overrides: ReadonlyMap<Permission, OverrideEffect>, key: Permission): OverrideState {
  const effect = overrides.get(key);
  return effect === "GRANT" ? "granted" : effect === "REVOKE" ? "revoked" : "inherited";
}

/** Applique un état d'ajustement : « hérité » retire la ligne, les deux autres la posent. */
export function setOverrideState(
  overrides: ReadonlyMap<Permission, OverrideEffect>,
  key: Permission,
  state: OverrideState,
): Map<Permission, OverrideEffect> {
  const next = new Map(overrides);
  if (state === "inherited") next.delete(key);
  else next.set(key, state === "granted" ? "GRANT" : "REVOKE");
  return next;
}

/** Ensemble effectif : l'héritage, plus les ajouts, moins les retraits (les retraits l'emportent). */
export function effectiveSet(
  inherited: ReadonlySet<Permission>,
  overrides: ReadonlyMap<Permission, OverrideEffect>,
): Set<Permission> {
  const result = new Set(inherited);
  for (const [key, effect] of overrides) if (effect === "GRANT") result.add(key);
  for (const [key, effect] of overrides) if (effect === "REVOKE") result.delete(key);
  return result;
}

export function overridesToRows(overrides: ReadonlyMap<Permission, OverrideEffect>): OverrideRow[] {
  return PERMISSION_CATALOG.filter((p) => overrides.has(p.key)).map((p) => ({
    permission: p.key,
    effect: overrides.get(p.key)!,
  }));
}

const ERROR_MESSAGES: Record<string, string> = {
  ROLE_NAME_TAKEN: "Ce nom est déjà utilisé par un autre rôle.",
  ROLE_IN_USE: "Ce rôle est attribué à des membres : changez leur rôle avant de l'archiver.",
  SYSTEM_ROLE: "Un rôle système ne peut être ni modifié ni archivé.",
  PERMISSION_NOT_HELD: "Vous ne pouvez pas accorder une permission que vous ne détenez pas.",
  RESERVED_PERMISSION: "Cette permission est réservée aux rôles système.",
  SELF_MODIFICATION: "Vous ne pouvez pas modifier votre propre rôle ni vos propres permissions.",
  OWNER_PROTECTED: "Seul un administrateur de la plateforme peut modifier ou retirer un autre propriétaire.",
  INVALID_PERMISSION: "Une permission demandée n'existe pas pour ce niveau.",
  INVALID_ROLE: "Ce rôle ne convient pas à ce niveau.",
  NOT_FOUND: "Élément introuvable.",
  LAST_OWNER: "Une organisation doit garder au moins un propriétaire.",
  LAST_SUPER_ADMIN: "La plateforme doit garder au moins un super administrateur.",
  VALIDATION: "Les informations saisies sont invalides.",
};

export function roleErrorMessage(code: string | undefined, fallback = "Une erreur est survenue. Réessayez."): string {
  return (code && ERROR_MESSAGES[code]) || fallback;
}

/** Lève une `ActionError` en français si la réponse n'est pas un succès ; renvoie le corps JSON sinon. */
export async function readOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json().catch(() => ({}))) as T;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new ActionError(roleErrorMessage(body?.error));
}

/**
 * Permissions qu'un acteur peut ajouter en ajustement : celles qu'il détient, plus toutes celles du niveau
 * participant (les droits du compte participant s'accordent au niveau plateforme sans les détenir).
 */
export function grantablePermissions(held: Iterable<Permission>): Permission[] {
  const result = new Set(held);
  for (const p of PERMISSION_CATALOG as readonly PermissionDef[]) if (p.scope === "PARTICIPANT") result.add(p.key as Permission);
  return [...result];
}

/** Identifiant du rôle système `systemKey` s'il est attribuable, sinon du premier rôle attribuable (chaîne vide si aucun). */
export function defaultRoleId(roles: readonly AssignableRoleRow[], systemKey: string): string {
  const wanted = roles.find((r) => r.systemKey === systemKey && r.assignable);
  return (wanted ?? roles.find((r) => r.assignable))?.id ?? "";
}
