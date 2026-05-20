import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId } from "@/lib/generate-id";
import { sendRegistrationConfirmation } from "@/lib/mail";
import { logActivity } from "@/lib/activity-log";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !checkRole(session.user.role, "MODERATEUR")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const status = searchParams.get("status");
  const teamId = searchParams.get("teamId");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (teamId) where.teamId = teamId;
  if (search) {
    where.OR = [
      { lastName: { contains: search } },
      { firstName: { contains: search } },
      { email: { contains: search } },
      { structure: { contains: search } },
    ];
  }

  const [total, registrations] = await Promise.all([
    prisma.registration.count({ where }),
    prisma.registration.findMany({
      where,
      include: { team: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({ data: registrations, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, lastName, firstName, structure, teamId, photo, idDocumentType, idDocumentNumber, idDocument, captchaToken } = body;

  // Vérifier si les inscriptions sont ouvertes (sauf pour les admins authentifiés)
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    const event = await prisma.event.findFirst();
    if (event && !event.registrationOpen) {
      return NextResponse.json({ error: "Les inscriptions sont actuellement fermées." }, { status: 403 });
    }
  }

  if (!teamId) {
    return NextResponse.json({ error: "Catégorie requise" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json({ error: "Catégorie non trouvée" }, { status: 400 });
  }

  // Les catégories anonymes ne sont accessibles qu'aux utilisateurs authentifiés
  if (team.anonymous) {
    if (!session?.user || !checkRole(session.user.role, "MODERATEUR")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  // Pour les catégories NON anonymes, tous les champs sont requis
  if (!team.anonymous) {
    if (!email || !lastName || !firstName || !structure || !idDocumentType || !idDocumentNumber || !photo || !idDocument) {
      return NextResponse.json({ error: "Champs requis manquants (photo et pièce d'identité incluses)" }, { status: 400 });
    }

    // Vérifier si l'email ou le numéro de document est bloqué (rejet silencieux)
    const blockedEmail = email ? await prisma.blockedEmail.findUnique({ where: { email } }) : null;
    const blockedDoc = idDocumentNumber ? await prisma.blockedDocument.findUnique({ where: { documentNumber: idDocumentNumber } }) : null;
    if (blockedEmail || blockedDoc) {
      return NextResponse.json({ id: "blocked", status: "PENDING", team: { name: team.name, color: team.color } }, { status: 201 });
    }

    // Vérifier si une inscription existe déjà pour cet email
    const existing = await prisma.registration.findFirst({ where: { email } });
    if (existing) {
      if (existing.status === "PENDING") {
        return NextResponse.json({ error: "Une inscription est déjà en cours de traitement pour cette adresse email." }, { status: 409 });
      }
      if (existing.status === "APPROVED") {
        return NextResponse.json({ error: "Une inscription validée existe déjà pour cette adresse email." }, { status: 409 });
      }
      if (existing.status === "REJECTED") {
        return NextResponse.json({ error: "Votre inscription a été rejetée. Vous pouvez demander un lien pour la modifier.", canResend: true, email }, { status: 409 });
      }
    }
  }

  // Vérifier CAPTCHA pour les appels publics (pas de session)
  if (!session?.user) {
    const settings = await prisma.settings.findFirst();
    if (settings?.recaptchaEnabled) {
      if (!captchaToken) {
        return NextResponse.json({ error: "CAPTCHA requis" }, { status: 400 });
      }
      const captchaRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${settings.recaptchaSecretKey}&response=${captchaToken}`,
      });
      const captchaData = await captchaRes.json();
      if (!captchaData.success) {
        return NextResponse.json({ error: "CAPTCHA invalide" }, { status: 400 });
      }
    }
  }

  const event = await prisma.event.findFirst();

  const registrationCount = await prisma.registration.count({ where: { teamId } });
  const id = generateId({
    categoryNumber: team.number,
    date: event?.date ? event.date.toISOString() : new Date().toISOString(),
    sequentialNumber: registrationCount + 1,
  });

  const registration = await prisma.registration.create({
    data: {
      id,
      email: email || "",
      lastName: lastName || "",
      firstName: firstName || "",
      structure: structure || "",
      teamId,
      photo: photo || null,
      idDocumentType: idDocumentType || "",
      idDocumentNumber: idDocumentNumber || "",
      idDocument: idDocument || null,
      ...(team.anonymous && { status: "APPROVED" }),
    },
    include: { team: true },
  });

  // Créer un snapshot de la soumission initiale
  await prisma.submissionSnapshot.create({
    data: {
      registrationId: registration.id,
      lastName: lastName || "",
      firstName: firstName || "",
      email: email || "",
      structure: structure || "",
      teamId,
      idDocumentType: idDocumentType || "",
      idDocumentNumber: idDocumentNumber || "",
      photo: photo || null,
      idDocument: idDocument || null,
    },
  });

  // Ne pas envoyer d'email pour les catégories anonymes
  if (!team.anonymous && email) {
    try {
      await sendRegistrationConfirmation(email, `${firstName} ${lastName}`);
    } catch (e) {
      console.error("Failed to send confirmation email:", e);
    }
  }

  await logActivity({
    type: "REGISTRATION_CREATED",
    userId: session?.user?.id,
    targetId: registration.id,
    details: {
      registrationName: team.anonymous ? "(anonyme)" : `${firstName} ${lastName}`,
      structure: structure || "",
      teamName: team.name,
      source: session?.user ? "admin" : "public",
      anonymous: team.anonymous,
    },
  });

  return NextResponse.json(registration, { status: 201 });
}
