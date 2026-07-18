import { prisma } from "@/lib/prisma";
import { MemberTable } from "@/components/event/MemberTable";
import { getEventOrgId } from "@/lib/event-org";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const orgId = await getEventOrgId(eventId);
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
