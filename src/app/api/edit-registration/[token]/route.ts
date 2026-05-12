import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { sendRegistrationConfirmation } from "@/lib/mail";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const registration = await prisma.registration.findUnique({
    where: { editToken: token },
    include: { team: true },
  });

  if (!registration || registration.status !== "REJECTED") {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  if (!registration.editTokenExpiresAt || registration.editTokenExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "expired", registrationId: registration.id },
      { status: 410 }
    );
  }

  return NextResponse.json({
    id: registration.id,
    lastName: registration.lastName,
    firstName: registration.firstName,
    email: registration.email,
    structure: registration.structure,
    teamId: registration.teamId,
    idDocumentType: registration.idDocumentType,
    idDocumentNumber: registration.idDocumentNumber,
    photo: registration.photo,
    idDocument: registration.idDocument,
    rejectionReason: registration.rejectionReason,
    rejectionDetails: registration.rejectionDetails,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const registration = await prisma.registration.findUnique({
    where: { editToken: token },
  });

  if (!registration || registration.status !== "REJECTED") {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  if (!registration.editTokenExpiresAt || registration.editTokenExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "expired", registrationId: registration.id },
      { status: 410 }
    );
  }

  const data = await req.json();
  const { lastName, firstName, email, structure, teamId, idDocumentType, idDocumentNumber, photo, idDocument } = data;

  if (!lastName || !firstName || !email || !structure || !teamId || !idDocumentType || !idDocumentNumber || !photo || !idDocument) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data: {
      lastName,
      firstName,
      email,
      structure,
      teamId,
      idDocumentType,
      idDocumentNumber,
      photo,
      idDocument,
      status: "PENDING",
      editToken: null,
      editTokenExpiresAt: null,
      rejectionReason: null,
      rejectionDetails: null,
    },
    include: { team: true },
  });

  await logActivity({
    type: "REGISTRATION_RESUBMITTED",
    targetId: registration.id,
    details: {
      registrationName: `${firstName} ${lastName}`,
      teamName: updated.team.name,
    },
  });

  try {
    await sendRegistrationConfirmation(email, `${firstName} ${lastName}`);
  } catch (e) {
    console.error("Failed to send confirmation email:", e);
  }

  return NextResponse.json(updated);
}
