import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const registration = await prisma.registration.findUnique({
    where: { id },
    include: { team: true },
  });

  if (!registration) {
    return NextResponse.json({ valid: false, error: "Badge inconnu" }, { status: 404 });
  }

  const event = await prisma.event.findFirst();

  return NextResponse.json({
    valid: registration.status === "APPROVED",
    registration: {
      id: registration.id,
      lastName: registration.lastName,
      firstName: registration.firstName,
      structure: registration.structure,
      photo: registration.photo,
      status: registration.status,
      allAccessGranted: registration.allAccessGranted,
      team: {
        name: registration.team.name,
        color: registration.team.color,
      },
    },
    event: event
      ? { title: event.title, location: event.location, date: event.date }
      : null,
  });
}
