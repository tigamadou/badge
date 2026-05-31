import { NextResponse } from "next/server";
import type { Prisma, ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";

export const GET = withOrgAuth("OWNER", async (req, { orgId }) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const eventId = url.searchParams.get("eventId");
  const userId = url.searchParams.get("userId");
  const cursor = url.searchParams.get("cursor");
  const take = Math.min(Number(url.searchParams.get("take") ?? 50), 200);

  const where: Prisma.ActivityLogWhereInput = { orgId };
  if (type) where.type = type as ActivityType;
  if (eventId) where.eventId = eventId;
  if (userId) where.userId = userId;
  if (from || to) {
    const range: Prisma.DateTimeFilter = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.createdAt = range;
  }

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  const hasMore = logs.length > take;
  const items = logs.slice(0, take).map((l) => ({
    id: l.id,
    type: l.type,
    eventId: l.eventId,
    targetId: l.targetId,
    details: l.details,
    staffActor: l.staffActor,
    createdAt: l.createdAt,
    user: l.user ? { id: l.user.id, email: l.user.email, name: l.user.name } : null,
  }));

  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
});
