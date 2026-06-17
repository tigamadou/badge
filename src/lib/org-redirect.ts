import type { UserContext } from "@/types/auth";

export function resolveHomeRedirect(
  ctx: UserContext | null,
  lastOrgIdHint: string | null,
): string {
  if (!ctx) return "/login";

  const memberOrgIds = new Set(ctx.orgMemberships.map((m) => m.orgId));

  if (ctx.isStaff) {
    if (lastOrgIdHint) return `/admin/${lastOrgIdHint}`;
    return "/staff";
  }

  if (memberOrgIds.size === 0) return "/profile?message=no-org";

  if (lastOrgIdHint && memberOrgIds.has(lastOrgIdHint)) {
    return `/admin/${lastOrgIdHint}`;
  }

  if (memberOrgIds.size === 1) {
    const onlyOrgId = ctx.orgMemberships[0].orgId;
    return `/admin/${onlyOrgId}`;
  }

  return "/select";
}
