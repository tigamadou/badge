import { prisma } from "@/lib/prisma";
import { MemberTable } from "@/components/event/MemberTable";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>;
}) {
  const { orgId, eventId } = await params;
  const members = await prisma.eventMembership.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, isStaff: true } },
    },
  });
  const serialised = members.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));
  return <MemberTable orgId={orgId} eventId={eventId} initial={serialised} />;
}
