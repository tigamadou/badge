import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "OPERATOR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
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

  const scanLog = await prisma.scanLog.create({
    data: {
      registrationId: registration.id,
      userId: session.user.id,
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
      id: scanLog.id,
      scannedAt: scanLog.scannedAt,
    },
  });
}
