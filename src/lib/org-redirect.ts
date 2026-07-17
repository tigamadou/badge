import type { UserContext } from "@/types/auth";

export function resolveHomeRedirect(
  ctx: UserContext | null,
  lastOrgIdHint: string | null,
): string {
  if (!ctx) return "/login";

  const memberOrgIds = new Set(ctx.orgMemberships.map((m) => m.orgId));

  if (ctx.isStaff) {
    if (lastOrgIdHint) return `/org/${lastOrgIdHint}`;
    return "/platform";
  }

  if (memberOrgIds.size === 0) return "/profile?message=no-org";

  if (lastOrgIdHint && memberOrgIds.has(lastOrgIdHint)) {
    return `/org/${lastOrgIdHint}`;
  }

  if (memberOrgIds.size === 1) {
    const onlyOrgId = ctx.orgMemberships[0].orgId;
    return `/org/${onlyOrgId}`;
  }

  return "/select";
}
