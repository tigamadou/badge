import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  if (!existing) {
    const event = await prisma.event.create({ data: { title, location, date: dateValue, logo } });
    return NextResponse.json(event);
  }

  const event = await prisma.event.update({
    where: { id: existing.id },
    data: { title, location, date: dateValue, logo },
  });
  return NextResponse.json(event);
}
