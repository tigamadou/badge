import { NextResponse } from "next/server";
import type { Prisma, ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";

const ALLOWED_TYPES: ReadonlySet<ActivityType> = new Set<ActivityType>([
  "REGISTRATION_CREATED",
  "REGISTRATION_APPROVED",
  "REGISTRATION_REJECTED",
  "REGISTRATION_UPDATED",
  "REGISTRATION_DELETED",
  "REGISTRATION_RESUBMITTED",
  "BADGE_PRINTED",
  "BADGE_BATCH_PRINTED",
  "BADGE_ALL_ACCESS_TOGGLED",
  "BADGE_EXPORTED",
  "BADGE_BATCH_EXPORTED",
  "BADGE_SCANNED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DELETED",
  "USER_PASSWORD_SET",
  "USER_LOGIN",
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "CATEGORY_DELETED",
  "CATEGORY_TEMPLATE_CREATED",
  "CATEGORY_TEMPLATE_UPDATED",
  "CATEGORY_TEMPLATE_DELETED",
  "ORG_CREATED",
  "ORG_UPDATED",
  "ORG_ARCHIVED",
  "ORG_RESTORED",
  "EVENT_CREATED",
  "EVENT_UPDATED",
  "EVENT_ARCHIVED",
  "EVENT_RESTORED",
]);

export const GET = withEventAuth(
  { minRole: "OPERATOR", allowArchived: true },
  async (req, { eventId, session, effectiveRole }) => {
    const url = new URL(req.url);
    const typeParam = url.searchParams.get("type");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "30")));

    const where: Prisma.ActivityLogWhereInput = { eventId };
    if (typeParam && ALLOWED_TYPES.has(typeParam as ActivityType)) {
      where.type = typeParam as ActivityType;
    }
    if (effectiveRole === "OPERATOR") {
      where.userId = session.user.id;
      where.type = "BADGE_SCANNED";
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          details: true,
          staffActor: true,
          createdAt: true,
          targetId: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, limit });
  },
);
