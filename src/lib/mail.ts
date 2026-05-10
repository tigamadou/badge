import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

async function getTransporter() {
  const settings = await prisma.settings.findFirst();
  if (settings?.smtpHost) {
    return nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
    });
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
  });
}

async function getMailFrom(): Promise<string> {
  const settings = await prisma.settings.findFirst();
  if (settings?.smtpFrom) return settings.smtpFrom;
  return process.env.SMTP_FROM || "noreply@investiture.local";
}

export async function sendRegistrationConfirmation(
  to: string,
  fullName: string
): Promise<void> {
  const transporter = await getTransporter();
  const from = await getMailFrom();
  await transporter.sendMail({
    from,
    to,
    subject: "Confirmation d'inscription — Cérémonie d'investiture",
    html: `
      <h2>Confirmation d'inscription</h2>
      <p>Bonjour ${fullName},</p>
      <p>Votre inscription a bien été reçue. Elle est en attente de validation.</p>
      <p>Vous recevrez un email dès que votre inscription sera traitée.</p>
    `,
  });
}

export async function sendStatusNotification(
  to: string,
  fullName: string,
  status: "APPROVED" | "REJECTED"
): Promise<void> {
  const transporter = await getTransporter();
  const from = await getMailFrom();

  if (status === "APPROVED") {
    await transporter.sendMail({
      from,
      to,
      subject: "Inscription validée — Cérémonie d'investiture",
      html: `
        <h2>Inscription validée</h2>
        <p>Bonjour ${fullName},</p>
        <p>Votre inscription a été <strong>validée</strong>.</p>
        <p>Vous recevrez un email lorsque votre badge sera prêt à être retiré.</p>
      `,
    });
  } else {
    await transporter.sendMail({
      from,
      to,
      subject: "Inscription rejetée — Cérémonie d'investiture",
      html: `
        <h2>Inscription rejetée</h2>
        <p>Bonjour ${fullName},</p>
        <p>Nous sommes désolés, votre inscription a été <strong>rejetée</strong>.</p>
        <p>Pour plus d'informations, veuillez contacter l'organisation.</p>
      `,
    });
  }
}

export async function sendBadgePrintedNotification(
  to: string,
  fullName: string,
  contactEmail: string,
  contactPhone: string
): Promise<void> {
  const transporter = await getTransporter();
  const from = await getMailFrom();

  await transporter.sendMail({
    from,
    to,
    subject: "Badge prêt — Cérémonie d'investiture",
    html: `
      <h2>Votre badge est prêt</h2>
      <p>Bonjour ${fullName},</p>
      <p>Votre badge a été imprimé et est prêt à être retiré.</p>
      <p>Pour le retrait, veuillez vous présenter <strong>muni(e) de votre pièce d'identité</strong> (celle fournie lors de votre inscription).</p>
      <p>Pour toute question concernant le retrait, vous pouvez nous contacter :</p>
      <ul>
        <li>Email : <a href="mailto:${contactEmail}">${contactEmail}</a></li>
        <li>Téléphone : ${contactPhone}</li>
      </ul>
    `,
  });
}
