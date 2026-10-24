import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { requireAuth, AuthError } from "@/lib/auth-participant";
import { buildRegistrationSnapshot } from "@/lib/participant-profile";
import { canRegisterToEvent } from "@/lib/profile-review";
import { sendRegistrationResubmitted } from "@/lib/mail";
import { allocateRegistrationId } from "@/lib/registration-id";
import { notifyRegistrationResubmitted } from "@/lib/notifications/triggers";
import { rewriteNotificationLinks } from "@/lib/notifications/rewrite-links";

const bodySchema = z.object({ categoryId: z.string().min(1).optional() });

const INVALID_BODY = { code: "INVALID_BODY", error: "Données invalides." };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // Corps optionnel : vide ou absent = comportement historique (meme categorie).
    const text = await req.text();
    let raw: unknown = {};
    if (text.trim() !== "") {
      try {
        raw = JSON.parse(text);
      } catch {
        return NextResponse.json(INVALID_BODY, { status: 400 });
      }
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(INVALID_BODY, { status: 400 });
    }
    const { categoryId } = parsed.data;

    const registration = await prisma.registration.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        eventId: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
        event: { select: { date: true } },
      },
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

    let targetCategory: { id: string; name: string; number: number } | null = null;
    if (categoryId && categoryId !== registration.categoryId) {
      targetCategory = await prisma.category.findFirst({
        where: { id: categoryId, eventId: registration.eventId },
        select: { id: true, name: true, number: true },
      });
      if (!targetCategory) {
        return NextResponse.json(
          { code: "INVALID_CATEGORY", error: "Cette catégorie n'appartient pas à l'évènement." },
          { status: 400 },
        );
      }
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

    // v4 (plan 09) : idem inscription -- les pieces deposees suffisent.
    if (!canRegisterToEvent(user.profileStatus)) {
      return NextResponse.json(
        { code: "PROFILE_NOT_SUBMITTED", error: "Complétez votre profil et déposez vos pièces avant de resoumettre." },
        { status: 403 },
      );
    }

    // Une seule transaction : nouvel ID, categorie, snapshot et PENDING changent ensemble.
    // Le updateMany conditionne sur REJECTED protege d'une double resoumission concurrente.
    const { newId, count } = await prisma.$transaction(async (tx) => {
      const newId = targetCategory
        ? await allocateRegistrationId(tx, {
            eventId: registration.eventId,
            eventDate: registration.event.date,
            categoryId: targetCategory.id,
            categoryNumber: targetCategory.number,
          })
        : registration.id;
      const { count } = await tx.registration.updateMany({
        where: { id: registration.id, status: "REJECTED" },
        data: {
          ...snapshot,
          status: "PENDING",
          rejectionReason: null,
          rejectionDetails: null,
          ...(targetCategory ? { id: newId, categoryId: targetCategory.id } : {}),
        },
      });
      // Les liens des notifications existantes suivent le nouvel ID (spec 24).
      if (newId !== registration.id) await rewriteNotificationLinks(registration.id, newId, tx);
      return { newId, count };
    });
    if (count === 0) {
      return NextResponse.json(
        { code: "INVALID_STATE", error: "Seules les inscriptions rejetées peuvent être resoumises." },
        { status: 409 },
      );
    }

    if (targetCategory) {
      await sendRegistrationResubmitted(newId, { previousCategoryName: registration.category.name });
    } else {
      await sendRegistrationResubmitted(newId);
    }

    await logActivity({
      type: "REGISTRATION_RESUBMITTED",
      userId: session.id,
      targetId: newId,
      eventId: registration.eventId,
      req,
      details: targetCategory
        ? {
            categoryChanged: {
              from: { id: registration.category.id, name: registration.category.name },
              to: { id: targetCategory.id, name: targetCategory.name },
            },
            idChanged: { from: registration.id, to: newId },
            // Lu par extractDiff() pour l'affichage avant/apres du journal d'activite.
            changes: {
              "Catégorie": { from: registration.category.name, to: targetCategory.name },
              "Identifiant": { from: registration.id, to: newId },
            },
          }
        : undefined,
    });

    await notifyRegistrationResubmitted(
      newId,
      session.id,
      targetCategory
        ? { categoryChanged: { from: registration.category.name, to: targetCategory.name } }
        : undefined,
    );

    return NextResponse.json({ ok: true, id: newId });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
