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
export async function unreadByRequest(
  userId: string,
  audience: ThreadAudience,
  requestIds: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = Object.fromEntries(requestIds.map((id) => [id, 0]));
  if (requestIds.length === 0) return counts;

  const reads = await prisma.printRequestRead.findMany({
    where: { userId, requestId: { in: requestIds } },
    select: { requestId: true, lastReadAt: true },
  });
  const lastRead = new Map(reads.map((r) => [r.requestId, r.lastReadAt]));

  const rows = await prisma.printRequestMessage.findMany({
    where: {
      requestId: { in: requestIds },
      ...(audience === "ORGANIZER" ? { internal: false } : {}),
      OR: [{ authorId: null }, { authorId: { not: userId } }],
    },
    select: { requestId: true, createdAt: true },
  });
  for (const row of rows) {
    const read = lastRead.get(row.requestId);
    if (!read || row.createdAt > read) counts[row.requestId] += 1;
  }
  return counts;
}

export async function countOrdersWithUnread(
  userId: string,
  audience: ThreadAudience,
  scope: { eventId?: string },
): Promise<number> {
  const orders = await prisma.printRequest.findMany({
    where: { status: { not: "DRAFT" }, ...(scope.eventId ? { eventId: scope.eventId } : {}) },
    select: { id: true },
  });
  const counts = await unreadByRequest(userId, audience, orders.map((o) => o.id));
  return Object.values(counts).filter((n) => n > 0).length;
}
