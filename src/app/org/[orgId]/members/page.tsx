import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadUserContext } from "@/lib/user-context";
import { hasOrgRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { MembersClient } from "./MembersClient";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  // Le changement de role est OWNER-only : sinon le role reste en lecture seule.
  const session = await getServerSession(authOptions);
  const ctx = session?.user?.id ? await loadUserContext(session.user.id) : null;
  const canManageRoles = ctx ? hasOrgRole(ctx, orgId, "OWNER") : false;
  const memberships = await prisma.orgMembership.findMany({
    where: { orgId },
    include: { user: { select: { id: true, email: true, name: true, archived: true } } },
    orderBy: { createdAt: "asc" },
  });

  const items = memberships.map((m) => ({
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    archived: m.user.archived,
    role: m.role,
    invitedAt: m.createdAt.toISOString(),
  }));

  return <MembersClient orgId={orgId} initial={items} canManageRoles={canManageRoles} />;
}
