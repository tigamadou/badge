import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { requireAuth, AuthError } from "@/lib/auth-participant";
import { computeParticipantProfileCompletedAt } from "@/lib/participant-profile";
import { submitProfile, getCurrentSubmission } from "@/lib/profile-review";
import { refreshPendingRegistrationSnapshots } from "@/lib/registration-snapshot-sync";
import { notifyProfileSubmitted } from "@/lib/notifications/triggers";
import { checkIdPhotoKey } from "@/lib/event-image-compliance";

const ID_DOC_TYPES = ["CNI", "Passeport", "Permis", "Autre"] as const;

// Whitelist explicite des champs editables par le participant. Le `name` et l'`email`
// restent figes au register (changement d'email = ticket support).
const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(120).optional(),
  lastName: z.string().trim().min(1).max(120).optional(),
  structure: z.string().trim().min(1).max(200).optional(),
  photo: z.string().trim().min(1).max(500).optional(),
  idDocumentType: z.enum(ID_DOC_TYPES).optional(),
  idDocumentNumber: z.string().trim().min(1).max(80).optional(),
  idDocument: z.string().trim().min(1).max(500).optional(),
});

type SanitizedUser = {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: Date | null;
  firstName: string | null;
  lastName: string | null;
  structure: string | null;
  photo: string | null;
  idDocumentType: string | null;
  idDocumentNumber: string | null;
  idDocument: string | null;
  participantProfileCompletedAt: Date | null;
  profileStatus: string;
  isStaff: boolean;
};

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  emailVerifiedAt: true,
  firstName: true,
  lastName: true,
  structure: true,
  photo: true,
  idDocumentType: true,
  idDocumentNumber: true,
  idDocument: true,
  participantProfileCompletedAt: true,
  profileStatus: true,
  isStaff: true,
} as const;

function authErrorResponse(err: AuthError) {
  return NextResponse.json({ code: err.code, error: err.message }, { status: err.httpStatus });
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const user = (await prisma.user.findUnique({
      where: { id: session.id },
      select: SAFE_USER_SELECT,
    })) as SanitizedUser | null;
    if (!user) {
      return NextResponse.json({ code: "NOT_FOUND", error: "Utilisateur introuvable." }, { status: 404 });
    }
    const currentSubmission = await getCurrentSubmission(session.id);
    return NextResponse.json({
      user,
      currentSubmission: currentSubmission
        ? {
            id: currentSubmission.id,
            status: currentSubmission.status,
            rejectionReasonLabel: currentSubmission.rejectionReasonLabel,
            rejectionDetails: currentSubmission.rejectionDetails,
            createdAt: currentSubmission.createdAt,
            reviewedAt: currentSubmission.reviewedAt,
          }
        : null,
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    throw err;
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth();

    const raw = await req.json().catch(() => null);
    const parsed = profileUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "INVALID_BODY", error: "Données invalides." },
        { status: 400 },
      );
    }

    // Zod omet les champs optionnels absents : parsed.data ne contient que les
    // champs explicitement passes, tous de type string. On l'utilise directement.
    const data = parsed.data;

    // ADR 2026-06-01 (v2-14 Task 7) : check blocage document plateforme si
    // idDocumentNumber est modifie. eventId=NULL = blocage global.
    if (data.idDocumentNumber !== undefined) {
      const platformBlocked = await prisma.blockedDocument.findFirst({
        where: { documentNumber: data.idDocumentNumber, eventId: null },
      });
      if (platformBlocked) {
        return NextResponse.json(
          { code: "DOCUMENT_BLOCKED", error: "Ce document ne peut pas etre utilise." },
          { status: 403 },
        );
      }
    }

    // Charge la valeur cible (existant + patch) pour recalculer la completion.
    const before = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        firstName: true,
        lastName: true,
        structure: true,
        photo: true,
        idDocumentType: true,
        idDocumentNumber: true,
        idDocument: true,
        email: true,
      },
    });
    if (!before) {
      return NextResponse.json({ code: "NOT_FOUND", error: "Utilisateur introuvable." }, { status: 404 });
    }
    // Photo d'identite : relue seulement si elle change (pas de blocage retroactif).
    if (data.photo !== undefined && data.photo !== before.photo) {
      const rejected = await checkIdPhotoKey(data.photo, [`profile/${session.id}/`]);
      if (rejected) return rejected;
    }
    const merged = { ...before, ...data };
    const participantProfileCompletedAt = computeParticipantProfileCompletedAt(merged);

    const updated = (await prisma.user.update({
      where: { id: session.id },
      data: { ...data, participantProfileCompletedAt },
      select: SAFE_USER_SELECT,
    })) as SanitizedUser;

    await logActivity({
      type: "USER_PROFILE_UPDATED",
      userId: session.id,
      targetId: session.id,
      details: { fields: Object.keys(data) },
      req,
    });

    // v4 (plan 08) : toute modification des pieces cree une nouvelle soumission et
    // repasse le profil en attente de validation. Les champs non lies a l'identite
    // (nom, prenom, structure) ne declenchent rien : submitProfile compare les pieces.
    const submissionBefore = await getCurrentSubmission(session.id);
    const submitted = await submitProfile(session.id);
    // submitProfile renvoie la soumission courante si rien n'a change : on ne notifie
    // le staff que pour une nouvelle soumission.
    if (submitted && submitted.id !== submissionBefore?.id) {
      await notifyProfileSubmitted(session.id);
    }

    // v4 (plan 15) : les inscriptions encore en attente suivent le profil. Une
    // inscription validee reste figee. Pas de catch : masquer un echec ici ne se
    // verrait qu'a l'impression du badge, et l'operation est idempotente.
    const refreshed = await refreshPendingRegistrationSnapshots(session.id);
    for (const outcome of refreshed) {
      await logActivity({
        type: "REGISTRATION_SNAPSHOT_REFRESHED",
        userId: session.id,
        targetId: outcome.registrationId,
        eventId: outcome.eventId,
        orgId: outcome.orgId,
        details:
          outcome.outcome === "refreshed"
            ? { outcome: outcome.outcome, fields: outcome.fields }
            : { outcome: outcome.outcome },
        req,
      });
    }

    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    throw err;
  }
}
