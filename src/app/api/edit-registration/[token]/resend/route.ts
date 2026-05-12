import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { sendEditLinkEmail, getContactInfo, areContactsConfigured } from "@/lib/mail";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const contacts = await getContactInfo();
  if (!areContactsConfigured(contacts)) {
    return NextResponse.json(
      { error: "Veuillez configurer les informations de contact (email, téléphone, site web) dans les paramètres." },
      { status: 400 }
    );
  }

  const registration = await prisma.registration.findUnique({
    where: { editToken: token },
  });

  if (!registration || registration.status !== "REJECTED") {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  // Vérifier si l'email est bloqué
  const blocked = await prisma.blockedEmail.findUnique({ where: { email: registration.email } });
  if (blocked) {
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 400 });
  }

  const newToken = randomUUID();
  await prisma.registration.update({
    where: { id: registration.id },
    data: {
      editToken: newToken,
      editTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  try {
    await sendEditLinkEmail(
      registration.email,
      `${registration.firstName} ${registration.lastName}`,
      newToken
    );
  } catch (e) {
    console.error("Failed to send edit link email:", e);
    return NextResponse.json({ error: "Erreur lors de l'envoi de l'email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
