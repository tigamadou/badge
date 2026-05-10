import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendStatusNotification, sendBadgePrintedNotification } from "@/lib/mail";

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

  // If marking as printed, add timestamp
  if (data.badgePrinted === true) {
    data.badgePrintedAt = new Date();
  }

  const registration = await prisma.registration.update({
    where: { id },
    data,
    include: { team: true },
  });

  // Send status notification if status changed
  if (data.status && (data.status === "APPROVED" || data.status === "REJECTED")) {
    try {
      await sendStatusNotification(
        registration.email,
        `${registration.firstName} ${registration.lastName}`,
        data.status
      );
    } catch (e) {
      console.error("Failed to send status notification:", e);
    }
  }

  // Send badge printed notification
  if (data.badgePrinted === true) {
    const settings = await prisma.settings.findFirst();
    if (!settings?.contactEmail || !settings?.contactPhone) {
      return NextResponse.json(
        { error: "Veuillez configurer l'email et le téléphone de contact dans les paramètres avant de confirmer l'impression." },
        { status: 400 }
      );
    }
    try {
      await sendBadgePrintedNotification(
        registration.email,
        `${registration.firstName} ${registration.lastName}`,
        settings.contactEmail,
        settings.contactPhone
      );
    } catch (e) {
      console.error("Failed to send badge printed notification:", e);
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
