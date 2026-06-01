import type { ActivityLog, ActivityType, Prisma } from "@prisma/client";
import { getDb } from "./db";

type ActivityFilters = {
  type: ActivityType;
  userId?: string;
  orgId?: string;
  eventId?: string;
  targetId?: string;
  staffActor?: boolean;
};

function buildWhere(filters: ActivityFilters): Prisma.ActivityLogWhereInput {
  const where: Prisma.ActivityLogWhereInput = { type: filters.type };
  if (filters.userId !== undefined) where.userId = filters.userId;
  if (filters.orgId !== undefined) where.orgId = filters.orgId;
  if (filters.eventId !== undefined) where.eventId = filters.eventId;
  if (filters.targetId !== undefined) where.targetId = filters.targetId;
  if (filters.staffActor !== undefined) where.staffActor = filters.staffActor;
  return where;
}

// Poll Prisma jusqu'a trouver un ActivityLog matchant les filtres, ou jusqu'au
// timeout (defaut 3000 ms, intervalle 200 ms). Retourne le log le plus recent.
// Throw avec un message qui dump les filtres si rien trouve.
export async function expectLastActivity(
  opts: ActivityFilters & { timeoutMs?: number },
): Promise<ActivityLog> {
  const timeoutMs = opts.timeoutMs ?? 3000;
  const intervalMs = 200;
  const deadline = Date.now() + timeoutMs;
  const where = buildWhere(opts);

  while (Date.now() < deadline) {
    const log = await getDb().activityLog.findFirst({
      where,
      orderBy: { createdAt: "desc" },
    });
    if (log) return log;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `expectLastActivity timeout (${timeoutMs} ms) : aucun ActivityLog matche ` +
      JSON.stringify({
        type: opts.type,
        userId: opts.userId,
        orgId: opts.orgId,
        eventId: opts.eventId,
        targetId: opts.targetId,
        staffActor: opts.staffActor,
      }),
  );
}

// Verifie qu'AUCUN ActivityLog matchant les filtres n'existe au moment de
// l'appel. Implementation : findFirst sans poll -- on attend que le caller
// ait deja attendu la fin de l'action (clic UI termine, response recue).
export async function expectNoActivity(opts: ActivityFilters): Promise<void> {
  const where = buildWhere(opts);
  const log = await getDb().activityLog.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });
  if (log) {
    throw new Error(
      `expectNoActivity : un ActivityLog inattendu existe (id=${log.id}, createdAt=${log.createdAt.toISOString()}) pour ` +
        JSON.stringify({
          type: opts.type,
          userId: opts.userId,
          orgId: opts.orgId,
          eventId: opts.eventId,
          targetId: opts.targetId,
          staffActor: opts.staffActor,
        }),
    );
  }
}
