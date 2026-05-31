import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePublicSettings, getPlatformRecaptcha } from "@/lib/settings";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { editRegistrationSchema } from "@/lib/validators/registration";
import { verifyUploadToken, UploadTokenError } from "@/lib/upload-token";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { sendRegistrationConfirmation } from "@/lib/mail";

export const runtime = "nodejs";

async function loadByToken(token: string) {
  const reg = await prisma.registration.findUnique({
    where: { editToken: token },
    include: {
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
          date: true,
          archived: true,
          registrationOpen: true,
          orgId: true,
          logo: true,
          location: true,
        },
      },
      category: {
        select: { id: true, name: true, color: true, number: true, anonymous: true },
      },
    },
  });
  if (!reg) return { code: "NOT_FOUND" as const };
  if (!reg.editTokenExpiresAt || reg.editTokenExpiresAt < new Date()) {
    return { code: "GONE" as const };
  }
  return { code: "OK" as const, reg };
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ip = extractClientIp(new Headers(req.headers));
  const rl = checkRateLimit(ip, "public-edit-get");
  if (!rl.ok) {
    return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });
  }

  const r = await loadByToken(token);
  if (r.code === "NOT_FOUND") {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  }
  if (r.code === "GONE") {
    return NextResponse.json({ code: "GONE" }, { status: 410 });
  }

  const categories = await prisma.category.findMany({
    where: { eventId: r.reg.eventId },
    orderBy: { number: "asc" },
  });
  const settings = await resolvePublicSettings(r.reg.eventId);

  return NextResponse.json({
    event: r.reg.event,
    categories,
    settings,
    registration: {
      id: r.reg.id,
      email: r.reg.email,
      firstName: r.reg.firstName,
      lastName: r.reg.lastName,
      structure: r.reg.structure,
      categoryId: r.reg.categoryId,
      idDocumentType: r.reg.idDocumentType,
      idDocumentNumber: r.reg.idDocumentNumber,
      photo: r.reg.photo,
      idDocument: r.reg.idDocument,
      rejectionReason: r.reg.rejectionReason,
      rejectionDetails: r.reg.rejectionDetails,
    },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ip = extractClientIp(new Headers(req.headers));
  const rl = checkRateLimit(ip, "public-edit-post");
  if (!rl.ok) {
    return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });
  }

  const r = await loadByToken(token);
  if (r.code === "NOT_FOUND") {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  }
  if (r.code === "GONE") {
    return NextResponse.json({ code: "GONE" }, { status: 410 });
  }
  const reg = r.reg;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ code: "BAD_JSON" }, { status: 400 });
  }
  const parsed = editRegistrationSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const cat = await prisma.category.findFirst({
    where: { id: data.categoryId, eventId: reg.eventId },
  });
  if (!cat) {
    return NextResponse.json({ code: "BAD_CATEGORY" }, { status: 400 });
  }

  // reCAPTCHA lu directement depuis PlatformSettings (pas via resolveSettings,
  // qui ne contient que contactEmail/contactPhone).
  const recaptcha = await getPlatformRecaptcha();
  const captcha = await verifyRecaptcha({
    enabled: recaptcha.recaptchaEnabled,
    secretKey: recaptcha.recaptchaSecretKey,
    token: data.recaptchaToken ?? "",
    remoteIp: ip,
  });
  if (!captcha.ok) {
    return NextResponse.json({ code: `RECAPTCHA_${captcha.code}` }, { status: 400 });
  }

  let newPhoto: string | null = null;
  let newDoc: string | null = null;
  if (data.photoToken) {
    try {
      const p = verifyUploadToken(data.photoToken);
      if (p.eventId !== reg.eventId || p.kind !== "photo") {
        return NextResponse.json({ code: "UPLOAD_TOKEN_MISMATCH" }, { status: 400 });
      }
      newPhoto = p.storageKey;
    } catch (e) {
      const code =
        e instanceof UploadTokenError ? `UPLOAD_TOKEN_${e.code}` : "UPLOAD_TOKEN_INVALID";
      return NextResponse.json({ code }, { status: 400 });
    }
  }
  if (data.idDocumentToken) {
    try {
      const p = verifyUploadToken(data.idDocumentToken);
      if (p.eventId !== reg.eventId || p.kind !== "document") {
        return NextResponse.json({ code: "UPLOAD_TOKEN_MISMATCH" }, { status: 400 });
      }
      newDoc = p.storageKey;
    } catch (e) {
      const code =
        e instanceof UploadTokenError ? `UPLOAD_TOKEN_${e.code}` : "UPLOAD_TOKEN_INVALID";
      return NextResponse.json({ code }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.submissionSnapshot.create({
      data: {
        registrationId: reg.id,
        email: reg.email,
        firstName: reg.firstName,
        lastName: reg.lastName,
        structure: reg.structure,
        categoryId: reg.categoryId,
        idDocumentType: reg.idDocumentType,
        idDocumentNumber: reg.idDocumentNumber,
        photo: reg.photo,
        idDocument: reg.idDocument,
      },
    });
    await tx.registration.update({
      where: { id: reg.id },
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        structure: data.structure,
        categoryId: cat.id,
        idDocumentType: data.idDocumentType,
        idDocumentNumber: data.idDocumentNumber,
        photo: newPhoto ?? reg.photo,
        idDocument: newDoc ?? reg.idDocument,
        status: "PENDING",
        rejectionReason: null,
        rejectionDetails: null,
        editToken: null,
        editTokenExpiresAt: null,
      },
    });
  });

  await logActivity({
    type: "REGISTRATION_RESUBMITTED",
    eventId: reg.eventId,
    targetId: reg.id,
    req: req as unknown as NextRequest,
  });

  sendRegistrationConfirmation(reg.id).catch((err) =>
    console.error("[mail] resubmit confirmation failed", err),
  );

  return NextResponse.json({ id: reg.id });
}
