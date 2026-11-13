import { effectivePermissions, type Permission, type PermissionTarget } from "@/lib/permissions";
import type { UserContext } from "@/types/auth";

// Identifiant fictif : sert à lire les droits de niveau ORG / EVENT que le rôle plateforme (ou le rôle
// d'organisation) confère sans viser une organisation ou un évènement précis.
const ANY = "__role-management__";

/**
 * Permissions que l'acteur détient pour une cible, tous niveaux confondus : un rôle plateforme peut porter
 * des permissions de niveau ORG et EVENT, un rôle d'organisation des permissions de niveau EVENT.
 */
export function heldOn(actor: UserContext, target: PermissionTarget): Set<Permission> {
  const held = new Set(effectivePermissions(actor, target));
  if (target.kind === "platform") {
    for (const p of effectivePermissions(actor, { kind: "org", orgId: ANY })) held.add(p);
    for (const p of effectivePermissions(actor, { kind: "event", eventId: ANY, orgId: ANY })) held.add(p);
  } else if (target.kind === "org") {
    for (const p of effectivePermissions(actor, { kind: "event", eventId: ANY, orgId: target.orgId })) held.add(p);
  }
  return held;
}
