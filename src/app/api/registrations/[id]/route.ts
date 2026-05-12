import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendStatusNotification, sendBadgePrintedNotification } from "@/lib/mail";
import { logActivity } from "@/lib/activity-log";
import { randomUUID } from "crypto";

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

  const previous = await prisma.registration.findUnique({ where: { id }, include: { team: true } });

  if (data.status === "APPROVED" && previous?.status === "REJECTED") {
    return NextResponse.json({ error: "Une inscription rejetée ne peut pas être validée" }, { status: 400 });
  }

  // If marking as printed, add timestamp
  if (data.badgePrinted === true) {
    data.badgePrintedAt = new Date();
  }

  // Générer un token de modification si rejet
  if (data.status === "REJECTED") {
    data.editToken = randomUUID();
    data.editTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  }

  const registration = await prisma.registration.update({
    where: { id },
    data,
    include: { team: true },
  });

  const regName = `${registration.firstName} ${registration.lastName}`;

  // Log activity based on what changed
  if (data.status === "APPROVED" || data.status === "REJECTED") {
    await logActivity({
      type: data.status === "APPROVED" ? "REGISTRATION_APPROVED" : "REGISTRATION_REJECTED",
      userId: session.user.id,
      targetId: id,
      details: {
        registrationName: regName,
        previousStatus: previous?.status,
        newStatus: data.status,
        ...(data.status === "REJECTED" && data.rejectionReason ? { rejectionReason: data.rejectionReason } : {}),
      },
    });
  } else if (data.badgePrinted === true) {
    await logActivity({
      type: "BADGE_PRINTED",
      userId: session.user.id,
      targetId: id,
      details: { registrationName: regName, teamName: registration.team.name },
    });
  } else if (data.allAccessGranted !== undefined) {
    await logActivity({
      type: "BADGE_ALL_ACCESS_TOGGLED",
      userId: session.user.id,
      targetId: id,
      details: { registrationName: regName, allAccessGranted: data.allAccessGranted },
    });
  } else {
    await logActivity({
      type: "REGISTRATION_UPDATED",
      userId: session.user.id,
      targetId: id,
      details: { registrationName: regName },
    });
  }

  // Send status notification if status changed
  if (data.status && (data.status === "APPROVED" || data.status === "REJECTED")) {
    try {
      await sendStatusNotification(
        registration.email,
        `${registration.firstName} ${registration.lastName}`,
        data.status,
        data.rejectionReason,
        data.rejectionDetails,
        data.editToken
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
  const registration = await prisma.registration.findUnique({ where: { id }, include: { team: true } });
  await prisma.registration.delete({ where: { id } });

  if (registration) {
    await logActivity({
      type: "REGISTRATION_DELETED",
      userId: session.user.id,
      targetId: id,
      details: {
        registrationName: `${registration.firstName} ${registration.lastName}`,
        teamName: registration.team.name,
      },
    });
  }

  return NextResponse.json({ success: true });
}
