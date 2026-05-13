import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const excludeAnonymous = searchParams.get("excludeAnonymous") === "true";

  const where: Record<string, unknown> = {};
  if (excludeAnonymous) {
    where.anonymous = false;
  }

  const [total, teams] = await Promise.all([
    prisma.team.count({ where }),
    prisma.team.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { registrations: true } } },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ data: teams, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "MODERATEUR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { name, color, number, neutralBadge, anonymous } = await req.json();
  if (!name || !color || number === undefined) {
    return NextResponse.json({ error: "Nom, couleur et numéro requis" }, { status: 400 });
  }

  const team = await prisma.team.create({
    data: { name, color, number, neutralBadge: neutralBadge ?? false, anonymous: anonymous ?? false },
  });

  await logActivity({
    type: "CATEGORY_CREATED",
    userId: session.user.id,
    targetId: team.id,
    details: { categoryName: name, color, number, anonymous: anonymous ?? false },
  });

  return NextResponse.json(team, { status: 201 });
}
