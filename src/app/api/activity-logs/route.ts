import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import type { ActivityType, Prisma } from "@prisma/client";

const TYPE_GROUPS: Record<string, ActivityType[]> = {
  registration: [
    "REGISTRATION_CREATED",
    "REGISTRATION_APPROVED",
    "REGISTRATION_REJECTED",
    "REGISTRATION_UPDATED",
    "REGISTRATION_DELETED",
  ],
  badge: [
    "BADGE_PRINTED",
    "BADGE_BATCH_PRINTED",
    "BADGE_ALL_ACCESS_TOGGLED",
    "BADGE_EXPORTED",
    "BADGE_BATCH_EXPORTED",
  ],
  scan: ["BADGE_SCANNED"],
  user: [
    "USER_CREATED",
    "USER_UPDATED",
    "USER_DELETED",
    "USER_PASSWORD_SET",
    "USER_LOGIN",
  ],
  config: [
    "CATEGORY_CREATED",
    "CATEGORY_UPDATED",
    "CATEGORY_DELETED",
    "EVENT_UPDATED",
    "SETTINGS_UPDATED",
  ],
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;

  const type = searchParams.get("type");
  const userId = searchParams.get("userId");
  const search = searchParams.get("search");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "30", 10)));

  const where: Prisma.ActivityLogWhereInput = {};

  if (type) {
    if (TYPE_GROUPS[type]) {
      where.type = { in: TYPE_GROUPS[type] };
    } else {
      where.type = type as ActivityType;
    }
  }

  if (userId) {
    where.userId = userId;
  }

  if (search) {
    where.details = { path: "$", string_contains: search };
  }

  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate + "T23:59:59.999Z") } : {}),
    };
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await req.json();
  const { type, targetId, details } = body;

  if (!type) {
    return NextResponse.json({ error: "Type requis" }, { status: 400 });
  }

  await logActivity({
    type,
    userId: session.user.id,
    targetId: targetId || null,
    details: details || null,
  });

  return NextResponse.json({ success: true });
}
