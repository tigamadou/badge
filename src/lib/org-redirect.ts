import type { UserContext } from "@/types/auth";
import { effectivePermissions, hasPermission } from "@/lib/permissions";

// Un membre d'evenement n'a un espace que si ses permissions sur l'evenement ne sont pas vides.
// L'organisation de l'evenement n'est pas connue du contexte : les ajustements propres a une
// organisation ne sont pas pris en compte ici (la garde du layout de l'evenement fait foi).
function eventMembershipHasAccess(ctx: UserContext, eventId: string): boolean {
  return effectivePermissions(ctx, { kind: "event", eventId, orgId: "" }).size > 0;
}

/** Evenements dont l'utilisateur est membre direct et dont l'espace lui est ouvert. */
export function accessibleEventIds(ctx: UserContext): string[] {
  return ctx.eventMemberships.filter((m) => eventMembershipHasAccess(ctx, m.eventId)).map((m) => m.eventId);
}

/** Organisations dont l'espace est ouvert (membre detenant `org.read`). */
export function accessibleOrgIds(ctx: UserContext): string[] {
  return ctx.orgMemberships
    .filter((m) => hasPermission(ctx, "org.read", { kind: "org", orgId: m.orgId }))
    .map((m) => m.orgId);
}

// v4 Bloc D : trois workspaces top-level independants (/platform, /org/[orgId],
// /event/[eventId]). Cette fonction calcule la destination post-login :
//   - 0 workspace accessible  -> espace participant (/account)
//   - 1 seul workspace        -> redirection directe (pas de friction)
//   - 2 ou plus               -> selecteur de workspace (/select)
export function resolveHomeRedirect(ctx: UserContext | null): string {
  if (!ctx) return "/login";

  const targets: string[] = [];
  // Le layout plateforme renvoie vers « / » sans platform.access : l'y envoyer ici ferait une boucle.
  if (ctx.isStaff && hasPermission(ctx, "platform.access", { kind: "platform" })) targets.push("/platform");
  for (const orgId of accessibleOrgIds(ctx)) targets.push(`/org/${orgId}`);
  for (const eventId of accessibleEventIds(ctx)) targets.push(`/event/${eventId}`);

  if (targets.length === 0) return "/account";
  if (targets.length === 1) return targets[0];
  return "/select";
}
