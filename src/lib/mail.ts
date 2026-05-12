import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

async function getTransporter() {
  const settings = await prisma.settings.findFirst();
  if (settings?.smtpHost) {
    return nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      ...(settings.smtpUser && settings.smtpPassword
        ? { auth: { user: settings.smtpUser, pass: settings.smtpPassword } }
        : {}),
    });
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    ...(process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }
      : {}),
  });
}

async function getMailFrom(): Promise<string> {
  const settings = await prisma.settings.findFirst();
  if (settings?.smtpFrom) return settings.smtpFrom;
  return process.env.SMTP_FROM || "noreply@investiture.local";
}

async function getEventInfo(): Promise<{ title: string; logoUrl: string }> {
  const event = await prisma.event.findFirst();
  const baseUrl = process.env.NEXTAUTH_URL || process.env.BASE_URL || "http://localhost:3000";
  return {
    title: event?.title || "Cérémonie d'investiture",
    logoUrl: event?.logo ? `${baseUrl}/api/files/${event.logo}` : "",
  };
}

function buildEmail(body: string, eventTitle: string, logoUrl: string): string {
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${eventTitle}" style="max-height:64px;max-width:200px;margin-bottom:16px;" />`
    : "";

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#0f172a;padding:28px 24px;">
              ${logoBlock}
              <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;letter-spacing:0.02em;">${eventTitle}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 28px;color:#334155;font-size:15px;line-height:1.7;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 28px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">${eventTitle}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendRegistrationConfirmation(
  to: string,
  fullName: string
): Promise<void> {
  const transporter = await getTransporter();
  const from = await getMailFrom();
  const { title, logoUrl } = await getEventInfo();

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;">Votre inscription a bien été reçue. Elle est en attente de validation.</p>
    <p style="margin:0;">Vous recevrez un email dès que votre inscription sera traitée.</p>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: `Confirmation d'inscription — ${title}`,
    html: buildEmail(body, title, logoUrl),
  });
}

export async function sendStatusNotification(
  to: string,
  fullName: string,
  status: "APPROVED" | "REJECTED",
  rejectionReason?: string,
  rejectionDetails?: string
): Promise<void> {
  const transporter = await getTransporter();
  const from = await getMailFrom();
  const { title, logoUrl } = await getEventInfo();

  if (status === "APPROVED") {
    const body = `
      <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
      <p style="margin:0 0 16px;">Votre inscription a été <span style="color:#059669;font-weight:600;">validée</span>.</p>
      <p style="margin:0;">Vous recevrez un email lorsque votre badge sera prêt à être retiré.</p>
    `;
    await transporter.sendMail({
      from,
      to,
      subject: `Inscription validée — ${title}`,
      html: buildEmail(body, title, logoUrl),
    });
  } else {
    const reasonBlock = rejectionReason
      ? `<p style="margin:0 0 8px;"><strong>Motif :</strong> ${rejectionReason}</p>`
      : "";
    const detailsBlock = rejectionDetails
      ? `<p style="margin:0 0 16px;color:#64748b;font-size:14px;">${rejectionDetails}</p>`
      : "";

    const body = `
      <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
      <p style="margin:0 0 16px;">Nous sommes désolés, votre inscription a été <span style="color:#e11d48;font-weight:600;">rejetée</span>.</p>
      ${reasonBlock}
      ${detailsBlock}
      <p style="margin:0;">Pour plus d'informations, veuillez contacter l'organisation.</p>
    `;
    await transporter.sendMail({
      from,
      to,
      subject: `Inscription rejetée — ${title}`,
      html: buildEmail(body, title, logoUrl),
    });
  }
}

export async function sendUserInvitation(
  to: string,
  userName: string,
  setupUrl: string
): Promise<void> {
  const transporter = await getTransporter();
  const from = await getMailFrom();
  const { title, logoUrl } = await getEventInfo();

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${userName}</strong>,</p>
    <p style="margin:0 0 16px;">Vous avez été invité(e) à rejoindre la plateforme <strong>${title}</strong>.</p>
    <p style="margin:0 0 24px;">Cliquez sur le bouton ci-dessous pour configurer votre mot de passe et activer votre compte :</p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${setupUrl}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">Configurer mon mot de passe</a>
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">Ce lien est valable 48 heures.</p>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: `Invitation — ${title}`,
    html: buildEmail(body, title, logoUrl),
  });
}

export async function sendBadgePrintedNotification(
  to: string,
  fullName: string,
  contactEmail: string,
  contactPhone: string
): Promise<void> {
  const transporter = await getTransporter();
  const from = await getMailFrom();
  const { title, logoUrl } = await getEventInfo();

  const body = `
    <p style="margin:0 0 16px;">Bonjour <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;">Votre badge a été imprimé et est prêt à être retiré.</p>
    <p style="margin:0 0 16px;">Pour le retrait, veuillez vous présenter <strong>muni(e) de votre pièce d'identité</strong> (celle fournie lors de votre inscription).</p>
    <p style="margin:0 0 8px;">Pour toute question concernant le retrait :</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
      <tr>
        <td style="padding:4px 0;color:#64748b;font-size:14px;">Email :</td>
        <td style="padding:4px 0 4px 8px;"><a href="mailto:${contactEmail}" style="color:#4f46e5;text-decoration:none;">${contactEmail}</a></td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#64748b;font-size:14px;">Tél :</td>
        <td style="padding:4px 0 4px 8px;color:#334155;">${contactPhone}</td>
      </tr>
    </table>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: `Badge prêt — ${title}`,
    html: buildEmail(body, title, logoUrl),
  });
}
