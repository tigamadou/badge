import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { loadPublicEventBySlug, PublicEventError } from "@/lib/public-event";
import { logActivity } from "@/lib/activity-log";
import { assertCanRegister, SubscriptionError } from "@/lib/subscription";
import { requireAuth, AuthError } from "@/lib/auth-participant";
import { buildRegistrationSnapshot } from "@/lib/participant-profile";
import { sendRegistrationConfirmation } from "@/lib/mail";
import { generateId } from "@/lib/generate-id";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  categoryId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await requireAuth();
    const { slug } = await ctx.params;
    const ip = extractClientIp(req.headers);
    const rl = checkRateLimit(ip, `event-register:${slug}`, { windowMs: 60_000, max: 10 });
    if (!rl.ok) {
      return NextResponse.json(
        { code: "RATE_LIMITED", error: "Trop de requêtes." },
        { status: 429 },
      );
    }

    let bundle: Awaited<ReturnType<typeof loadPublicEventBySlug>>;
    try {
      bundle = await loadPublicEventBySlug(slug);
    } catch (err) {
      if (err instanceof PublicEventError) {
        const status = err.code === "NOT_FOUND" ? 404 : 403;
        return NextResponse.json({ code: err.code, error: err.code }, { status });
      }
      throw err;
    }
    const { event } = bundle;

    const raw = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "INVALID_BODY", error: "Données invalides." },
        { status: 400 },
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
        { code: "PROFILE_INCOMPLETE", error: "Profil incomplet : complétez votre profil avant de vous inscrire." },
        { status: 400 },
      );
    }

    const existing = await prisma.registration.findUnique({
      where: { userId_eventId: { userId: session.id, eventId: event.id } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { code: "ALREADY_REGISTERED", error: "Vous êtes déjà inscrit à cet événement.", registrationId: existing.id },
        { status: 409 },
      );
    }

    const category = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, eventId: event.id },
    });
    if (!category) {
      return NextResponse.json({ code: "BAD_CATEGORY", error: "Catégorie invalide." }, { status: 400 });
    }

    // ADR 2026-06-01 (v2-14 Task 7) : cumule blocage plateforme (eventId=null)
    // et blocage event-scoped (eventId=event.id). `in: [null, X]` n'accepte pas
    // null dans le typage Prisma pour les champs nullable -- on passe par OR.
    const blockedEmail = await prisma.blockedEmail.findFirst({
      where: {
        email: snapshot.snapshotEmail,
        OR: [{ eventId: null }, { eventId: event.id }],
      },
    });
    if (blockedEmail) {
      return NextResponse.json({ code: "EMAIL_BLOCKED", error: "Email bloqué." }, { status: 409 });
    }
    const blockedDoc = await prisma.blockedDocument.findFirst({
      where: {
        documentNumber: snapshot.snapshotIdDocumentNumber,
        OR: [{ eventId: null }, { eventId: event.id }],
      },
    });
    if (blockedDoc) {
      return NextResponse.json({ code: "DOCUMENT_BLOCKED", error: "Document bloqué." }, { status: 409 });
    }

    try {
      await assertCanRegister(event.id);
    } catch (e) {
      if (e instanceof SubscriptionError) {
        const error =
          e.code === "PARTICIPANT_LIMIT" ? "Inscriptions complètes." : "Inscriptions fermées.";
        return NextResponse.json({ code: e.code, error }, { status: e.httpStatus });
      }
      throw e;
    }

    const sequential = await prisma.registration.count({
      where: { eventId: event.id, categoryId: category.id },
    });
    const dateIso = event.date.toISOString().slice(0, 10);

    // Collision retry sur l'ID metier (cf. /api/public/events/[slug]/registrations).
    let id = generateId({
      categoryNumber: category.number,
      date: dateIso,
      sequentialNumber: sequential + 1,
    });
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await prisma.registration.findUnique({ where: { id } });
      if (!exists) break;
      id = generateId({
        categoryNumber: category.number,
        date: dateIso,
        sequentialNumber: sequential + 1 + attempt + 1,
      });
    }

    const registration = await prisma.registration.create({
      data: {
        id,
        userId: session.id,
        eventId: event.id,
        categoryId: category.id,
        ...snapshot,
        status: "PENDING",
      },
    });

    await logActivity({
      type: "REGISTRATION_CREATED",
      userId: session.id,
      eventId: event.id,
      targetId: registration.id,
      req,
    });

    sendRegistrationConfirmation(registration.id).catch((err) => {
      console.error("[mail] sendRegistrationConfirmation failed", err);
    });

    return NextResponse.json({ id: registration.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
