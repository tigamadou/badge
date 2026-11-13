import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserContext } from "@/lib/user-context";
import { effectivePermissions, type Permission } from "@/lib/permissions";
import type { UserContext } from "@/types/auth";

/**
 * Garde de page de l'espace organisation : une permission, ou l'une d'une liste.
 * Refus : retour au tableau de bord de l'organisation (jamais d'écran vide).
 */
export async function requireOrgPagePermission(
  orgId: string,
  permission: Permission | readonly Permission[],
  path: string,
): Promise<{ ctx: UserContext; permissions: Set<Permission> }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(path)}`);
  const ctx = await getUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const permissions = effectivePermissions(ctx, { kind: "org", orgId });
  const required: readonly Permission[] = typeof permission === "string" ? [permission] : permission;
  if (!required.some((p) => permissions.has(p))) redirect(`/org/${orgId}`);
  return { ctx, permissions };
}
