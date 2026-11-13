import { NextResponse } from "next/server";
import type { ActivityType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { parseListPage } from "@/lib/list-query";
import { withStaffAuth } from "@/lib/with-staff-auth";

// Liste blanche des ActivityType valides (filtre exact) : on s'appuie sur
// l'enum genere par Prisma pour eviter d'avoir a maintenir une liste.
function isActivityType(value: string): value is ActivityType {
  // Lite check : Prisma valide a la requete, mais on rejette ici pour 400 propre.
  return /^[A-Z_]+$/.test(value);
}

export const GET = withStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);

  const typeParam = searchParams.get("type") ?? undefined;
  const orgId = searchParams.get("orgId") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const eventId = searchParams.get("eventId") ?? undefined;
  const staffActorParam = searchParams.get("staffActor") ?? "all";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const { page, pageSize, skip, take } = parseListPage(searchParams);

  const where: Prisma.ActivityLogWhereInput = {};
  if (typeParam) {
    if (!isActivityType(typeParam)) {
      return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
    }
    where.type = typeParam as ActivityType;
  }
  if (orgId) where.orgId = orgId;
  if (userId) where.userId = userId;
  if (eventId) where.eventId = eventId;
  if (staffActorParam === "true") where.staffActor = true;
  else if (staffActorParam === "false") where.staffActor = false;

  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) range.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) range.lte = d;
    }
    if (range.gte || range.lte) where.createdAt = range;
  }

  const [activities, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        type: true,
        userId: true,
        orgId: true,
        eventId: true,
        targetId: true,
        details: true,
        staffActor: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return NextResponse.json({
    activities,
    total,
    page,
    pageSize,
  });
}, { permission: "activity.read" });
