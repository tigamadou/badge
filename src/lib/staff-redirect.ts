import type { UserContext } from "@/types/auth";

// Dispatcher post-login : decide ou rediriger l'utilisateur authentifie.
// Priorite : staff > org unique > multi-org/event > pas de membership.
// Plan 03 enrichira la branche org pour gerer le selecteur multi-org.
export function computeStaffRedirect(ctx: UserContext): string {
  if (ctx.isStaff) return "/staff";
  if (ctx.orgMemberships.length === 1) {
    return `/admin/${ctx.orgMemberships[0].orgId}`;
  }
  if (ctx.orgMemberships.length > 1 || ctx.eventMemberships.length > 0) {
    return "/select";
  }
  return "/profile?message=no-org";
}
