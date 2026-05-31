import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadPublicEventBySlug, PublicEventError } from "@/lib/public-event";
import { getPlatformRecaptcha } from "@/lib/settings";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { publicRegistrationSchema } from "@/lib/validators/registration";
import {
  verifyUploadToken,
  UploadTokenError,
  type UploadTokenPayload,
} from "@/lib/upload-token";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { generateId } from "@/lib/generate-id";
import { logActivity } from "@/lib/activity-log";
import { sendRegistrationConfirmation } from "@/lib/mail";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const ip = extractClientIp(new Headers(req.headers));
  const rl = checkRateLimit(ip, `public-registration:${slug}`);
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes", code: "RATE_LIMITED" }, { status: 429 });
  }

  let bundle: Awaited<ReturnType<typeof loadPublicEventBySlug>>;
  try {
    bundle = await loadPublicEventBySlug(slug);
  } catch (err) {
    if (err instanceof PublicEventError) {
      const status = err.code === "NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ error: err.code, code: err.code }, { status });
    }
    throw err;
  }
  const { event } = bundle;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide", code: "BAD_JSON" }, { status: 400 });
  }
  const parsed = publicRegistrationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", code: "VALIDATION", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, eventId: event.id },
  });
  if (!category) {
    return NextResponse.json({ error: "Catégorie invalide", code: "BAD_CATEGORY" }, { status: 400 });
  }

  const recaptcha = await getPlatformRecaptcha();
  const captcha = await verifyRecaptcha({
    enabled: recaptcha.recaptchaEnabled,
    secretKey: recaptcha.recaptchaSecretKey,
    token: data.recaptchaToken ?? "",
    remoteIp: ip,
  });
  if (!captcha.ok) {
    return NextResponse.json(
      { error: "reCAPTCHA refusé", code: `RECAPTCHA_${captcha.code}` },
      { status: 400 },
    );
  }

  const blockedEmail = await prisma.blockedEmail.findUnique({
    where: { eventId_email: { eventId: event.id, email: data.email } },
  });
  if (blockedEmail) {
    return NextResponse.json({ error: "Email bloqué", code: "EMAIL_BLOCKED" }, { status: 409 });
  }
  const blockedDoc = await prisma.blockedDocument.findUnique({
    where: {
      eventId_documentNumber: {
        eventId: event.id,
        documentNumber: data.idDocumentNumber,
      },
    },
  });
  if (blockedDoc) {
    return NextResponse.json({ error: "Document bloqué", code: "DOCUMENT_BLOCKED" }, { status: 409 });
  }

  const org = await prisma.organization.findUnique({ where: { id: event.orgId } });
  if (org && org.quotaMaxRegistrations !== null && org.quotaMaxRegistrations !== undefined) {
    const count = await prisma.registration.count({
      where: { event: { orgId: org.id }, status: { in: ["PENDING", "APPROVED"] } },
    });
    if (count >= org.quotaMaxRegistrations) {
      return NextResponse.json(
        { error: "Inscriptions complètes", code: "QUOTA_EXCEEDED" },
        { status: 429 },
      );
    }
  }

  let photoPayload: UploadTokenPayload;
  let docPayload: UploadTokenPayload;
  try {
    photoPayload = verifyUploadToken(data.photoToken);
  } catch (e) {
    const code = e instanceof UploadTokenError ? `UPLOAD_TOKEN_${e.code}` : "UPLOAD_TOKEN_INVALID";
    return NextResponse.json({ error: "Photo invalide", code }, { status: 400 });
  }
  try {
    docPayload = verifyUploadToken(data.idDocumentToken);
  } catch (e) {
    const code = e instanceof UploadTokenError ? `UPLOAD_TOKEN_${e.code}` : "UPLOAD_TOKEN_INVALID";
    return NextResponse.json({ error: "Document invalide", code }, { status: 400 });
  }
  if (photoPayload.eventId !== event.id || photoPayload.kind !== "photo") {
    return NextResponse.json({ error: "Photo invalide", code: "UPLOAD_TOKEN_MISMATCH" }, { status: 400 });
  }
  if (docPayload.eventId !== event.id || docPayload.kind !== "document") {
    return NextResponse.json({ error: "Document invalide", code: "UPLOAD_TOKEN_MISMATCH" }, { status: 400 });
  }

  const sequential = await prisma.registration.count({
    where: { eventId: event.id, categoryId: category.id },
  });
  const dateIso = event.date.toISOString().slice(0, 10);

  // Collision retry : generateId melange un spacer aleatoire 2 chiffres,
  // donc une collision sur le meme (categoryNumber, date, sequentialNumber)
  // est possible mais rare. Quelques retries suffisent.
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
      eventId: event.id,
      categoryId: category.id,
      email: data.email,
      lastName: data.lastName,
      firstName: data.firstName,
      structure: data.structure,
      idDocumentType: data.idDocumentType,
      idDocumentNumber: data.idDocumentNumber,
      photo: photoPayload.storageKey,
      idDocument: docPayload.storageKey,
      status: "PENDING",
    },
  });

  await logActivity({
    type: "REGISTRATION_CREATED",
    eventId: event.id,
    targetId: registration.id,
    req: req as unknown as NextRequest,
  });

  sendRegistrationConfirmation(registration.id).catch((err) => {
    console.error("[mail] sendRegistrationConfirmation failed", err);
  });

  return NextResponse.json({ id: registration.id }, { status: 201 });
}
