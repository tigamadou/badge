import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "MODERATEUR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const registration = await prisma.registration.findUnique({ where: { id } });
  if (!registration) {
    return NextResponse.json({ error: "Inscription non trouvée" }, { status: 404 });
  }

  await prisma.blockedDocument.upsert({
    where: { documentNumber: registration.idDocumentNumber },
    create: { documentNumber: registration.idDocumentNumber, reason: `Bloqué depuis inscription ${id}` },
    update: {},
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "MODERATEUR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const registration = await prisma.registration.findUnique({ where: { id } });
  if (!registration) {
    return NextResponse.json({ error: "Inscription non trouvée" }, { status: 404 });
  }

  await prisma.blockedDocument.deleteMany({ where: { documentNumber: registration.idDocumentNumber } });

  return NextResponse.json({ success: true });
}
