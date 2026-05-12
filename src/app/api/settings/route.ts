import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { logActivity } from "@/lib/activity-log";
import { getContactInfo, areContactsConfigured } from "@/lib/mail";

export async function GET() {
  const settings = await prisma.settings.findFirst();
  if (!settings) return NextResponse.json(null);

  // Ne jamais exposer la clé secrète recaptcha côté client
  const { recaptchaSecretKey, ...publicSettings } = settings;
  return NextResponse.json(publicSettings);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "ADMIN")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const { smtpHost, smtpPort, smtpFrom, smtpUser, smtpPassword, smtpSecure, contactEmail, contactPhone, websiteUrl,
    recaptchaEnabled, recaptchaSiteKey, recaptchaSecretKey } = body;

  // Seul le SUPER_ADMIN peut modifier les paramètres reCAPTCHA
  const isSuperAdmin = checkRole(session.user.role, "SUPER_ADMIN");

  const baseData = { smtpHost, smtpPort, smtpFrom, smtpUser, smtpPassword, smtpSecure, contactEmail, contactPhone, websiteUrl };
  const data = isSuperAdmin
    ? { ...baseData, recaptchaEnabled, recaptchaSiteKey, recaptchaSecretKey }
    : baseData;

  const existing = await prisma.settings.findFirst();
  if (!existing) {
    const settings = await prisma.settings.create({ data });
    await logActivity({
      type: "SETTINGS_UPDATED",
      userId: session.user.id,
      details: { changes: isSuperAdmin ? "SMTP, contact et reCAPTCHA" : "SMTP et contact" },
    });
    return NextResponse.json(settings);
  }

  const settings = await prisma.settings.update({
    where: { id: existing.id },
    data,
  });

  await logActivity({
    type: "SETTINGS_UPDATED",
    userId: session.user.id,
    details: { changes: isSuperAdmin ? "SMTP, contact et reCAPTCHA" : "SMTP et contact" },
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

    const contacts = await getContactInfo();
    if (!areContactsConfigured(contacts)) {
      return NextResponse.json(
        { error: "Veuillez configurer les informations de contact (email, téléphone, site web) dans les paramètres." },
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
