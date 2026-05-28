import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "MODERATEUR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const data = await req.json();

  if (data.number !== undefined) {
    if (data.number < 0 || data.number > 999) {
      return NextResponse.json({ error: "Le numéro doit être entre 0 et 999" }, { status: 400 });
    }

    const existingTeam = await prisma.team.findFirst({
      where: { number: data.number, id: { not: id } },
    });
    if (existingTeam) {
      return NextResponse.json({ error: "Ce numéro est déjà utilisé par une autre catégorie" }, { status: 409 });
    }
  }

  const team = await prisma.team.update({
    where: { id },
    data: {
      name: data.name,
      color: data.color,
      ...(data.number !== undefined && { number: data.number }),
      ...(data.neutralBadge !== undefined && { neutralBadge: data.neutralBadge }),
      ...(data.anonymous !== undefined && { anonymous: data.anonymous }),
    },
  });

  await logActivity({
    type: "CATEGORY_UPDATED",
    userId: session.user.id,
    targetId: id,
    details: { categoryName: team.name },
  });

  return NextResponse.json(team);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "MODERATEUR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const team = await prisma.team.findUnique({ where: { id } });
  await prisma.team.delete({ where: { id } });

  if (team) {
    await logActivity({
      type: "CATEGORY_DELETED",
      userId: session.user.id,
      targetId: id,
      details: { categoryName: team.name },
    });
  }

  return NextResponse.json({ success: true });
}
