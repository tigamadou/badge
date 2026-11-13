import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadPermissions } from "@/lib/auth-guards";
import type { Permission } from "@/lib/permissions";

/**
 * Garde d'une page de l'espace plateforme : sans session, redirige vers la connexion ;
 * sans la permission (cible plateforme), redirige vers le tableau de bord.
 * Renvoie les permissions effectives pour que la page filtre ses boutons.
 */
export async function requirePlatformPage(
  permission: Permission,
  callbackUrl = "/platform",
): Promise<{ userId: string; permissions: Set<Permission> }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  const permissions = await loadPermissions(session.user.id, { kind: "platform" });
  if (!permissions.has(permission)) redirect("/platform");
  return { userId: session.user.id, permissions };
}
