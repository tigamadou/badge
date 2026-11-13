import { prisma } from "@/lib/prisma";
import { loadPermissions } from "@/lib/auth-guards";
import { permissionScopeOf, PERMISSION_KEYS, type Permission, type PermissionScope } from "@/lib/permissions/catalog";
import type { PermissionTarget } from "@/lib/permissions/resolve";
import { docTargetScope } from "./routes";

export interface DocParams {
  orgId?: string;
  eventId?: string;
}

/** Cible de permissions d'une page d'après sa route ; null si l'évènement ou l'organisation visés manquent. */
export async function resolveDocTarget(route: string, params: DocParams): Promise<PermissionTarget | null> {
  const scope = docTargetScope(route);
  if (scope === "PLATFORM") return { kind: "platform" };
  if (scope === "PARTICIPANT") return { kind: "participant" };
  if (scope === "ORG") return params.orgId ? { kind: "org", orgId: params.orgId } : null;
  if (!params.eventId) return null;
  const event = await prisma.event.findUnique({ where: { id: params.eventId }, select: { orgId: true } });
  return event ? { kind: "event", eventId: params.eventId, orgId: event.orgId } : null;
}

/** Permissions effectives de l'utilisateur sur la cible de la page ; ensemble vide si la cible est introuvable. */
export async function permissionsForRoute(userId: string, route: string, params: DocParams): Promise<Set<Permission>> {
  const target = await resolveDocTarget(route, params);
  return target ? loadPermissions(userId, target) : new Set();
}

/** Décision d'un bloc `:::permission` : détenue ou non pour une clé de la portée évaluée, indéterminée sinon. */
export function blockDecider(perms: ReadonlySet<Permission>, scope: PermissionScope): (key: string) => boolean | undefined {
  return (key) => {
    if (!PERMISSION_KEYS.has(key)) return false;
    if (permissionScopeOf(key as Permission) !== scope) return undefined;
    return perms.has(key as Permission);
  };
}
