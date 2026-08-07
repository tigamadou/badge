import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { requireAuth, AuthError } from "@/lib/auth-participant";
import { buildRegistrationSnapshot } from "@/lib/participant-profile";
import { sendRegistrationResubmitted } from "@/lib/mail";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const registration = await prisma.registration.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, eventId: true },
    });
    if (!registration) {
      return NextResponse.json({ code: "NOT_FOUND", error: "Inscription introuvable." }, { status: 404 });
    }
    if (registration.userId !== session.id) {
      return NextResponse.json({ code: "FORBIDDEN", error: "Accès refusé." }, { status: 403 });
    }
    if (registration.status !== "REJECTED") {
      return NextResponse.json(
        { code: "INVALID_STATE", error: "Seules les inscriptions rejetées peuvent être resoumises." },
        { status: 409 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        structure: true,
        photo: true,
        idDocumentType: true,
        idDocumentNumber: true,
        idDocument: true,
        profileStatus: true,
      },
    });
    if (!user) {
      return NextResponse.json({ code: "NOT_FOUND", error: "Utilisateur introuvable." }, { status: 404 });
    }

    let snapshot;
    try {
      snapshot = buildRegistrationSnapshot(user);
    } catch {
      return NextResponse.json(
        { code: "PROFILE_INCOMPLETE", error: "Votre profil est incomplet : complétez-le avant de resoumettre." },
        { status: 400 },
      );
    }

    // v4 (plan 08) : la resoumission suppose un profil valide par la plateforme.
    if (user.profileStatus !== "APPROVED") {
      return NextResponse.json(
        { code: "PROFILE_NOT_APPROVED", error: "Votre profil doit être validé par la plateforme avant de resoumettre." },
        { status: 403 },
      );
    }

    await prisma.registration.update({
      where: { id: registration.id },
      data: {
        ...snapshot,
        status: "PENDING",
        rejectionReason: null,
        rejectionDetails: null,
      },
    });

    await sendRegistrationResubmitted(registration.id);

    await logActivity({
      type: "REGISTRATION_RESUBMITTED",
      userId: session.id,
      targetId: registration.id,
      eventId: registration.eventId,
      req,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
