import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { loadPublicEventBySlug, PublicEventError } from "@/lib/public-event";
import { logActivity } from "@/lib/activity-log";
import { assertCanRegister, SubscriptionError } from "@/lib/subscription";
import { requireAuth, AuthError } from "@/lib/auth-participant";
import { buildRegistrationSnapshot } from "@/lib/participant-profile";
import { canRegisterToEvent } from "@/lib/profile-review";
import { sendRegistrationConfirmation } from "@/lib/mail";
import { notifyRegistrationCreated } from "@/lib/notifications/triggers";
import { allocateRegistrationId } from "@/lib/registration-id";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { getPlatformRecaptcha } from "@/lib/settings";
import { verifyRecaptcha } from "@/lib/recaptcha";

export const runtime = "nodejs";

const bodySchema = z.object({
  categoryId: z.string().min(1),
  recaptchaToken: z.string().optional(),
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

    // Avant les controles de profil et d'inscription.
    const recaptcha = await getPlatformRecaptcha();
    const captcha = await verifyRecaptcha({
      enabled: recaptcha.recaptchaEnabled,
      secretKey: recaptcha.recaptchaSecretKey,
      token: parsed.data.recaptchaToken ?? "",
      remoteIp: ip,
    });
    if (!captcha.ok) {
      // La raison donnee par Google n'est lisible que dans les logs serveur.
      console.warn("[recaptcha] verification refusee", {
        route: "event-register",
        code: captcha.code,
        details: captcha.details,
      });
      return NextResponse.json(
        { code: `RECAPTCHA_${captcha.code}`, error: "Vérification reCAPTCHA refusée." },
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
        { code: "PROFILE_INCOMPLETE", error: "Profil incomplet : complétez votre profil avant de vous inscrire." },
        { status: 400 },
      );
    }

    // v4 (plan 09) : deposer ses pieces suffit pour s'inscrire. L'inscription
    // restera non approuvable tant que le profil n'est pas valide (cf. approve).
    if (!canRegisterToEvent(user.profileStatus)) {
      return NextResponse.json(
        {
          code: "PROFILE_NOT_SUBMITTED",
          error: "Complétez votre profil et déposez vos pièces avant de vous inscrire.",
        },
        { status: 403 },
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

    const id = await allocateRegistrationId(prisma, {
      eventId: event.id,
      eventDate: event.date,
      categoryId: category.id,
      categoryNumber: category.number,
    });

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

    await notifyRegistrationCreated(registration.id, session.id);

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
