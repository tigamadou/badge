import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserContext } from "@/lib/user-context";
import { effectivePermissions, type Permission } from "@/lib/permissions";
import type { UserContext } from "@/types/auth";

/**
 * Garde de page de l'espace évènement. `null` : au moins une permission sur l'évènement ;
 * liste : l'une d'elles. Refus : `/event/[eventId]` dont la page d'atterrissage décide
 * (jamais de redirection vers l'atterrissage lui-même : pas de boucle) ; aucune permission : `/select`.
 */
export async function requireEventPagePermission(
  eventId: string,
  permission: Permission | readonly Permission[] | null,
  path: string,
): Promise<{
  ctx: UserContext;
  event: { id: string; orgId: string; title: string; archived: boolean };
  orgId: string;
  permissions: Set<Permission>;
  isStaffActor: boolean;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(path)}`);
  const ctx = await getUserContext(session.user.id);
  if (!ctx) redirect("/login");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, orgId: true, title: true, archived: true },
  });
  if (!event) notFound();

  const permissions = effectivePermissions(ctx, { kind: "event", eventId, orgId: event.orgId });
  if (permissions.size === 0) redirect("/select");
  if (permission !== null) {
    const required: readonly Permission[] = typeof permission === "string" ? [permission] : permission;
    if (!required.some((p) => permissions.has(p))) redirect(`/event/${eventId}`);
  }

  const isStaffActor =
    ctx.isStaff &&
    !ctx.orgMemberships.some((m) => m.orgId === event.orgId) &&
    !ctx.eventMemberships.some((m) => m.eventId === eventId);
  return { ctx, event, orgId: event.orgId, permissions, isStaffActor };
}
