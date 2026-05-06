import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !checkRole(session.user.role, "OPERATOR")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;

  const operatorId = searchParams.get("operatorId");
  const registrationId = searchParams.get("registrationId");
  const search = searchParams.get("search");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || "50", 10));

  const where: Record<string, unknown> = {};

  if (operatorId) {
    where.userId = operatorId;
  }

  if (registrationId) {
    where.registrationId = registrationId;
  }

  if (search) {
    where.registration = {
      OR: [
        { lastName: { contains: search } },
        { firstName: { contains: search } },
      ],
    };
  }

  if (dateFrom || dateTo) {
    where.scannedAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }

  const [scanLogs, total] = await Promise.all([
    prisma.scanLog.findMany({
      where,
      include: {
        registration: {
          include: {
            team: true,
          },
        },
        user: true,
      },
      orderBy: { scannedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.scanLog.count({ where }),
  ]);

  return NextResponse.json({
    scanLogs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
