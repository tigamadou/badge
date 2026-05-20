import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { logActivity } from "@/lib/activity-log";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const data = await req.json();

  const updateData: Record<string, unknown> = {};
  if (data.name) updateData.name = data.name;
  if (data.email) updateData.email = data.email;
  if (data.role) updateData.role = data.role;
  if (data.password) updateData.password = await hash(data.password, 12);

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  await logActivity({
    type: "USER_UPDATED",
    userId: session.user.id,
    targetId: id,
    details: { userName: user.name, userEmail: user.email, userRole: user.role },
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "Impossible de supprimer votre propre compte" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true, role: true } });
  await prisma.user.delete({ where: { id } });

  if (user) {
    await logActivity({
      type: "USER_DELETED",
      userId: session.user.id,
      targetId: id,
      details: { userName: user.name, userEmail: user.email, userRole: user.role },
    });
  }

  return NextResponse.json({ success: true });
}
