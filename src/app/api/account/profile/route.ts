import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { requireAuth, AuthError } from "@/lib/auth-participant";
import { computeParticipantProfileCompletedAt } from "@/lib/participant-profile";

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
    return NextResponse.json({ user });
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

    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    throw err;
  }
}
