import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "OPERATOR")) {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const { registrationId } = await req.json();

  if (!registrationId) {
    return NextResponse.json({ error: "registrationId requis" }, { status: 400 });
  }

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { team: true },
  });

  if (!registration) {
    return NextResponse.json({ valid: false, error: "Badge inconnu" }, { status: 404 });
  }

  await logActivity({
    type: "BADGE_SCANNED",
    userId: session.user.id,
    targetId: registration.id,
    details: {
      registrationName: `${registration.firstName} ${registration.lastName}`,
      structure: registration.structure,
      teamName: registration.team.name,
      teamColor: registration.team.color,
      status: registration.status,
    },
  });

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
    scanLog: {
      id: "activity-log",
      scannedAt: new Date().toISOString(),
    },
  });
}
