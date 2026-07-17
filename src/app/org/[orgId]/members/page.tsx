import { prisma } from "@/lib/prisma";
import { MembersClient } from "./MembersClient";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
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

  return <MembersClient orgId={orgId} initial={items} />;
}
