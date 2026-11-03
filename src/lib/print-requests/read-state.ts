import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ThreadAudience } from "./thread";

// Ne recule jamais : une lecture plus ancienne que la dernière enregistrée est ignorée.
export async function markRead(requestId: string, userId: string, at: Date = new Date()): Promise<void> {
  await prisma.printRequestRead.upsert({
    where: { requestId_userId: { requestId, userId } },
    create: { requestId, userId, lastReadAt: at },
    update: {},
  });
  await prisma.printRequestRead.updateMany({
    where: { requestId, userId, lastReadAt: { lt: at } },
    data: { lastReadAt: at },
  });
}

// Entrées visibles de l'audience, postérieures à la dernière lecture, dont l'auteur n'est pas
// l'utilisateur (une entrée automatique sans auteur compte pour tout le monde).
// Agrégation côté base : le coût ne dépend pas de la taille des fils.
export async function unreadByRequest(
  userId: string,
  audience: ThreadAudience,
  requestIds: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = Object.fromEntries(requestIds.map((id) => [id, 0]));
  if (requestIds.length === 0) return counts;

  const rows = await prisma.$queryRaw<{ requestId: string; n: bigint }[]>(Prisma.sql`
    SELECT m.requestId AS requestId, COUNT(*) AS n
    FROM PrintRequestMessage m
    LEFT JOIN PrintRequestRead r ON r.requestId = m.requestId AND r.userId = ${userId}
    WHERE m.requestId IN (${Prisma.join(requestIds)})
      ${audience === "ORGANIZER" ? Prisma.sql`AND m.internal = false` : Prisma.empty}
      AND (m.authorId IS NULL OR m.authorId <> ${userId})
      AND (r.lastReadAt IS NULL OR m.createdAt > r.lastReadAt)
    GROUP BY m.requestId
  `);
  for (const row of rows) counts[row.requestId] = Number(row.n);
  return counts;
}

export async function countOrdersWithUnread(
  userId: string,
  audience: ThreadAudience,
  scope: { eventId?: string },
): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
    SELECT COUNT(*) AS n
    FROM PrintRequest o
    WHERE o.status <> 'DRAFT'
      ${scope.eventId ? Prisma.sql`AND o.eventId = ${scope.eventId}` : Prisma.empty}
      AND EXISTS (
        SELECT 1
        FROM PrintRequestMessage m
        LEFT JOIN PrintRequestRead r ON r.requestId = m.requestId AND r.userId = ${userId}
        WHERE m.requestId = o.id
          ${audience === "ORGANIZER" ? Prisma.sql`AND m.internal = false` : Prisma.empty}
          AND (m.authorId IS NULL OR m.authorId <> ${userId})
          AND (r.lastReadAt IS NULL OR m.createdAt > r.lastReadAt)
      )
  `);
  return Number(rows[0].n);
}
