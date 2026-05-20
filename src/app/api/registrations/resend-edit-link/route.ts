import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { sendEditLinkEmail, getContactInfo, areContactsConfigured } from "@/lib/mail";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email requis" }, { status: 400 });
  }

  const contacts = await getContactInfo();
  if (!areContactsConfigured(contacts)) {
    return NextResponse.json(
      { error: "Veuillez configurer les informations de contact (email, téléphone, site web) dans les paramètres." },
      { status: 400 }
    );
  }

  // Vérifier si l'email ou le numéro de document est bloqué (rejet silencieux)
  const blockedEmail = await prisma.blockedEmail.findUnique({ where: { email } });
  const regForDocCheck = await prisma.registration.findFirst({ where: { email } });
  const blockedDoc = regForDocCheck ? await prisma.blockedDocument.findUnique({ where: { documentNumber: regForDocCheck.idDocumentNumber } }) : null;
  if (blockedEmail || blockedDoc) {
    return NextResponse.json({ success: true });
  }

  const registration = await prisma.registration.findFirst({
    where: { email, status: "REJECTED" },
  });

  if (!registration) {
    // Ne pas révéler si l'email existe ou non
    return NextResponse.json({ success: true });
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
  }

  // Toujours retourner success pour ne pas révéler l'existence de l'email
  return NextResponse.json({ success: true });
}
