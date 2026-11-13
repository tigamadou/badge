import { prisma } from "@/lib/prisma";
import type { ActivityType, Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

export type LogActivityInput = {
  type: ActivityType;
  userId?: string;
  orgId?: string;
  eventId?: string;
  targetId?: string;
  details?: Prisma.InputJsonValue;
  req?: NextRequest;
};

function extractRequestMeta(req?: NextRequest) {
  if (!req) return { ipAddress: undefined, userAgent: undefined };
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const userAgent = req.headers.get("user-agent") || undefined;
  return { ipAddress, userAgent };
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  let { orgId } = input;
  const { eventId, userId, type, targetId, details, req } = input;

  if (eventId && !orgId) {
    const ev = await prisma.event.findUnique({
      where: { id: eventId },
      select: { orgId: true },
    });
    orgId = ev?.orgId ?? undefined;
  }

  // Staff « acteur » : staff sans appartenance à l'org (ni à l'évènement) du journal (aligné sur isStaffActor).
  let staffActor = false;
  if (userId && orgId) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isStaff: true,
        orgMemberships: { where: { orgId }, select: { orgId: true } },
        ...(eventId ? { eventMemberships: { where: { eventId }, select: { eventId: true } } } : {}),
      },
    });
    staffActor = !!u?.isStaff && u.orgMemberships.length === 0 && !(u.eventMemberships?.length ?? 0);
  }

  const meta = extractRequestMeta(req);

  await prisma.activityLog.create({
    data: {
      type,
      userId: userId ?? null,
      orgId: orgId ?? null,
      eventId: eventId ?? null,
      targetId: targetId ?? null,
      details: details ?? undefined,
      staffActor,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });
}
