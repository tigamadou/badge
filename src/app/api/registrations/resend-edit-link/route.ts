import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { sendEditLinkEmail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email requis" }, { status: 400 });
  }

  // Vérifier si l'email est bloqué
  const blocked = await prisma.blockedEmail.findUnique({ where: { email } });
  if (blocked) {
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 400 });
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
