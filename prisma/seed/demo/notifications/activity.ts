import { ActivityType } from "@prisma/client";
import { prisma } from "../../../../src/lib/prisma";
import { DEMO_SLUG_PREFIX } from "../../constants";
import { isDemoUserWhere } from "../billing/world";

/** Types du domaine impression : écrits (et nettoyés) par le lot 2a. */
export const PRINT_ACTIVITY_TYPES: ActivityType[] = Object.values(ActivityType).filter((t) => t.startsWith("PRINT_"));

/**
 * Supprime le journal de démo hors impression : entrées rattachées à une organisation `demo-`,
 * à un évènement de ces organisations ou à un utilisateur de démo.
 */
export async function cleanupActivity(): Promise<number> {
  const orgs = await prisma.organization.findMany({ where: { slug: { startsWith: DEMO_SLUG_PREFIX } }, select: { id: true } });
  const orgIds = orgs.map((o) => o.id);
  const events = await prisma.event.findMany({ where: { orgId: { in: orgIds } }, select: { id: true } });
  const users = await prisma.user.findMany({ where: isDemoUserWhere, select: { id: true } });
  const res = await prisma.activityLog.deleteMany({
    where: {
      type: { notIn: PRINT_ACTIVITY_TYPES },
      OR: [
        { orgId: { in: orgIds } },
        { eventId: { in: events.map((e) => e.id) } },
        { userId: { in: users.map((u) => u.id) } },
      ],
    },
  });
  return res.count;
}
