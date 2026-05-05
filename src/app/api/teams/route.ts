import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { registrations: true } } },
  });
  return NextResponse.json(teams);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { name, color } = await req.json();
  if (!name || !color) {
    return NextResponse.json({ error: "Nom et couleur requis" }, { status: 400 });
  }

  const team = await prisma.team.create({ data: { name, color } });
  return NextResponse.json(team, { status: 201 });
}
