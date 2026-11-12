import { prisma } from "@/lib/prisma";
import type { UserContext } from "@/types/auth";

export async function loadUserContext(userId: string): Promise<UserContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isStaff: true,
      staffRole: true,
      archived: true,
      orgMemberships: { select: { orgId: true, role: true } },
      eventMemberships: { select: { eventId: true, role: true } },
    },
  });

  if (!user || user.archived) return null;

  return {
    user: { id: user.id, email: user.email, name: user.name },
    isStaff: user.isStaff,
    staffRole: user.staffRole,
    orgMemberships: user.orgMemberships.flatMap((m) => (m.role ? [{ ...m, role: m.role }] : [])),
    eventMemberships: user.eventMemberships.flatMap((m) => (m.role ? [{ ...m, role: m.role }] : [])),
  };
}
