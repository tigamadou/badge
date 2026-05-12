import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBadgePrintedNotification, getContactInfo, areContactsConfigured } from "@/lib/mail";
import { logActivity } from "@/lib/activity-log";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // SUPER_ADMIN ne peut pas marquer les badges comme imprimés
  if (session.user.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Les super administrateurs ne peuvent pas effectuer cette action." }, { status: 403 });
  }

  const { ids } = await req.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "IDs requis" }, { status: 400 });
  }

  const contacts = await getContactInfo();
  if (!areContactsConfigured(contacts)) {
    return NextResponse.json(
      { error: "Veuillez configurer les informations de contact (email, téléphone, site web) dans les paramètres." },
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
          contacts!.contactEmail,
          contacts!.contactPhone
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
