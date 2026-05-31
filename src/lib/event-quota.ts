import { prisma } from "@/lib/prisma";

export class QuotaError extends Error {
  constructor(public readonly limit: number, public readonly current: number) {
    super(`QUOTA_EXCEEDED (current=${current}, limit=${limit})`);
  }
}

// Seules les inscriptions PENDING + APPROVED comptent dans le quota.
// Les REJECTED sont exclues (decision spec ll. 244-245).
export async function countCountableRegistrations(eventId: string): Promise<number> {
  return prisma.registration.count({
    where: { eventId, status: { in: ["PENDING", "APPROVED"] } },
  });
}

export async function assertQuotaAvailable(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true, organization: { select: { quotaMaxRegistrations: true } } },
  });
  if (!event) return;
  const limit = event.organization.quotaMaxRegistrations;
  if (limit == null) return;
  const current = await countCountableRegistrations(eventId);
  if (current >= limit) {
    throw new QuotaError(limit, current);
  }
}
