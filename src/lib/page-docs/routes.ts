import type { PermissionScope } from "@/lib/permissions/catalog";

// Module pur (aucune base, aucun module généré) : importé aussi par l'outil hors ligne scripts/page-docs.

/**
 * Portée des permissions d'une page, d'après son espace : les gardes de chaque espace testent
 * des permissions de la portée de l'espace (y compris sous /platform/organizations/[orgId]).
 */
export function docTargetScope(route: string): PermissionScope {
  const space = route.split("/").filter(Boolean)[0];
  if (space === "org") return "ORG";
  if (space === "event") return "EVENT";
  if (space === "account") return "PARTICIPANT";
  return "PLATFORM";
}
