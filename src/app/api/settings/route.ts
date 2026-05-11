import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { logActivity } from "@/lib/activity-log";

export async function GET() {
  const settings = await prisma.settings.findFirst();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { smtpHost, smtpPort, smtpFrom, smtpUser, smtpPassword, smtpSecure, contactEmail, contactPhone } = await req.json();

  const existing = await prisma.settings.findFirst();
  if (!existing) {
    const settings = await prisma.settings.create({
      data: { smtpHost, smtpPort, smtpFrom, smtpUser, smtpPassword, smtpSecure, contactEmail, contactPhone },
    });
    await logActivity({
      type: "SETTINGS_UPDATED",
      userId: session.user.id,
      details: { changes: "SMTP et contact" },
    });
    return NextResponse.json(settings);
  }

  const settings = await prisma.settings.update({
    where: { id: existing.id },
    data: { smtpHost, smtpPort, smtpFrom, smtpUser, smtpPassword, smtpSecure, contactEmail, contactPhone },
  });

  await logActivity({
    type: "SETTINGS_UPDATED",
    userId: session.user.id,
    details: { changes: "SMTP et contact" },
  });

  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { testEmail } = await req.json();

  try {
    const settings = await prisma.settings.findFirst();
    if (!settings || !settings.smtpHost) {
      return NextResponse.json(
        { error: "Aucune configuration SMTP trouvée. Enregistrez d'abord vos paramètres SMTP." },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      ...(settings.smtpUser && settings.smtpPassword
        ? { auth: { user: settings.smtpUser, pass: settings.smtpPassword } }
        : {}),
    });

    await transporter.sendMail({
      from: settings.smtpFrom,
      to: testEmail,
      subject: "Test SMTP — Investiture",
      html: "<p>La configuration SMTP fonctionne correctement.</p>",
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
