import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendStatusNotification } from "@/lib/mail";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const registration = await prisma.registration.findUnique({
    where: { id },
    include: { team: true },
  });

  if (!registration) {
    return NextResponse.json({ error: "Inscription non trouvée" }, { status: 404 });
  }

  return NextResponse.json(registration);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const data = await req.json();

  const registration = await prisma.registration.update({
    where: { id },
    data,
    include: { team: true },
  });

  // Envoyer un email si le statut a changé
  if (data.status && (data.status === "APPROVED" || data.status === "REJECTED")) {
    try {
      await sendStatusNotification(
        registration.email,
        `${registration.firstName} ${registration.lastName}`,
        data.status,
        registration.id
      );
    } catch (e) {
      console.error("Failed to send status notification:", e);
    }
  }

  return NextResponse.json(registration);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.registration.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
