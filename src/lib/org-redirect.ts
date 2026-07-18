import type { UserContext } from "@/types/auth";

// v4 Bloc D : trois workspaces top-level independants (/platform, /org/[orgId],
// /event/[eventId]). Cette fonction calcule la destination post-login :
//   - 0 workspace accessible  -> espace participant (/account)
//   - 1 seul workspace        -> redirection directe (pas de friction)
//   - 2 ou plus               -> selecteur de workspace (/select)
// Remplace l'ancien hint localStorage (illisible cote serveur).
export function resolveHomeRedirect(ctx: UserContext | null): string {
  if (!ctx) return "/login";

  const targets: string[] = [];
  if (ctx.isStaff) targets.push("/platform");
  for (const m of ctx.orgMemberships) targets.push(`/org/${m.orgId}`);
  for (const m of ctx.eventMemberships) targets.push(`/event/${m.eventId}`);

  if (targets.length === 0) return "/account";
  if (targets.length === 1) return targets[0];
  return "/select";
}
