import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId } from "@/lib/generate-id";
import { sendRegistrationConfirmation } from "@/lib/mail";
import { logActivity } from "@/lib/activity-log";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const registrations = await prisma.registration.findMany({
    include: { team: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(registrations);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, lastName, firstName, structure, teamId, photo, idDocumentType, idDocumentNumber, idDocument, captchaToken } = body;

  if (!email || !lastName || !firstName || !structure || !teamId || !idDocumentType || !idDocumentNumber) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  // Vérifier si c'est un appel public (pas de session) => vérifier CAPTCHA
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    if (!captchaToken) {
      return NextResponse.json({ error: "CAPTCHA requis" }, { status: 400 });
    }
    const captchaRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`,
    });
    const captchaData = await captchaRes.json();
    if (!captchaData.success) {
      return NextResponse.json({ error: "CAPTCHA invalide" }, { status: 400 });
    }
  }

  const event = await prisma.event.findFirst();
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json({ error: "Catégorie non trouvée" }, { status: 400 });
  }

  const registrationCount = await prisma.registration.count({ where: { teamId } });
  const id = generateId({
    categoryNumber: team.number,
    date: event?.date ? event.date.toISOString() : new Date().toISOString(),
    sequentialNumber: registrationCount + 1,
  });

  const registration = await prisma.registration.create({
    data: { id, email, lastName, firstName, structure, teamId, photo, idDocumentType, idDocumentNumber, idDocument },
    include: { team: true },
  });

  try {
    await sendRegistrationConfirmation(email, `${firstName} ${lastName}`);
  } catch (e) {
    console.error("Failed to send confirmation email:", e);
  }

  await logActivity({
    type: "REGISTRATION_CREATED",
    userId: session?.user?.id,
    targetId: registration.id,
    details: {
      registrationName: `${firstName} ${lastName}`,
      structure,
      teamName: team.name,
      source: session?.user ? "admin" : "public",
    },
  });

  return NextResponse.json(registration, { status: 201 });
}
