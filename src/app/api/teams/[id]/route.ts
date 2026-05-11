import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const data = await req.json();

  const team = await prisma.team.update({
    where: { id },
    data: { name: data.name, color: data.color },
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
  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
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
