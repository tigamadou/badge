import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const NOTIFICATION_RETENTION_DAYS = 90;

// Supprime les notifications lues depuis plus de 90 jours ; les non lues restent.
export async function purgeReadNotifications(
  now: Date = new Date(),
  db: Prisma.TransactionClient = prisma,
): Promise<number> {
  const limit = new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await db.notification.deleteMany({ where: { readAt: { lt: limit } } });
  return count;
}
