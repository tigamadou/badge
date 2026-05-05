import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
  });
}

const FROM = process.env.SMTP_FROM || "noreply@investiture.local";

export async function sendRegistrationConfirmation(
  to: string,
  fullName: string
): Promise<void> {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: FROM,
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
  status: "APPROVED" | "REJECTED",
  registrationId: string
): Promise<void> {
  const transporter = getTransporter();

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  if (status === "APPROVED") {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: "Inscription validée — Cérémonie d'investiture",
      html: `
        <h2>Inscription validée</h2>
        <p>Bonjour ${fullName},</p>
        <p>Votre inscription a été <strong>validée</strong>.</p>
        <p>Vous pouvez consulter et télécharger votre badge ici :</p>
        <p><a href="${baseUrl}/badge/${registrationId}">Voir mon badge</a></p>
      `,
    });
  } else {
    await transporter.sendMail({
      from: FROM,
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
