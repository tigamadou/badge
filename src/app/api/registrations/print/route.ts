import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBadgePrintedNotification } from "@/lib/mail";
import { logActivity } from "@/lib/activity-log";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { ids } = await req.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "IDs requis" }, { status: 400 });
  }

  const settings = await prisma.settings.findFirst();
  if (!settings?.contactEmail || !settings?.contactPhone) {
    return NextResponse.json(
      { error: "Veuillez configurer l'email et le téléphone de contact dans les paramètres avant de confirmer l'impression." },
      { status: 400 }
    );
  }

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const id of ids) {
    try {
      const registration = await prisma.registration.findUnique({ where: { id } });

      if (!registration || registration.status !== "APPROVED" || registration.badgePrinted) {
        skipped++;
        continue;
      }

      await prisma.registration.update({
        where: { id },
        data: { badgePrinted: true, badgePrintedAt: new Date() },
      });

      try {
        await sendBadgePrintedNotification(
          registration.email,
          `${registration.firstName} ${registration.lastName}`,
          settings.contactEmail,
          settings.contactPhone
        );
      } catch (e) {
        console.error(`Failed to send notification for ${id}:`, e);
      }

      success++;
    } catch {
      errors++;
    }
  }

  await logActivity({
    type: "BADGE_BATCH_PRINTED",
    userId: session.user.id,
    details: { count: success, skipped, errors, totalRequested: ids.length },
  });

  return NextResponse.json({ success, skipped, errors });
}
