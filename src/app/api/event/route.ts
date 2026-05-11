import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function GET() {
  const event = await prisma.event.findFirst();
  return NextResponse.json(event);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { title, location, date, logo } = await req.json();
  const dateValue = new Date(date);

  const existing = await prisma.event.findFirst();
  let event;
  if (!existing) {
    event = await prisma.event.create({ data: { title, location, date: dateValue, logo } });
  } else {
    event = await prisma.event.update({
      where: { id: existing.id },
      data: { title, location, date: dateValue, logo },
    });
  }

  await logActivity({
    type: "EVENT_UPDATED",
    userId: session.user.id,
    targetId: event.id,
    details: { eventTitle: title, location },
  });

  return NextResponse.json(event);
}
