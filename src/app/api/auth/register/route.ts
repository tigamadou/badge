import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { getPlatformRecaptcha } from "@/lib/settings";
import { verifyRecaptcha } from "@/lib/recaptcha";
import {
  generateToken,
  hashToken,
  computeExpiry,
  EMAIL_VERIFY_TTL_MS,
} from "@/lib/auth-tokens";
import { sendAccountVerifyEmail } from "@/lib/mail";
import { safeInternalPath } from "@/lib/safe-path";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(6).max(200),
  name: z.string().trim().min(1).max(120),
  recaptchaToken: z.string().optional(),
  // v4 (plan 09) : destination a reprendre apres verification de l'email. Validee
  // par safeInternalPath ; une valeur externe est ignoree silencieusement.
  // `nullish` et non `optional` : le formulaire poste explicitement `next: null`
  // quand la page n'a pas de destination.
  next: z.string().max(512).nullish(),
});

export async function POST(req: NextRequest) {
  const ip = extractClientIp(req.headers);

  const rate = checkRateLimit(ip, "auth-register", { windowMs: 60_000, max: 10 });
  if (!rate.ok) {
    return NextResponse.json(
      { code: "RATE_LIMITED", error: "Trop de tentatives, réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } },
    );
  }

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "INVALID_BODY", error: "Données invalides." },
      { status: 400 },
    );
  }
  const { email: rawEmail, password, name, recaptchaToken } = parsed.data;
  const email = rawEmail.toLowerCase().trim();

  const recaptcha = await getPlatformRecaptcha();
  const captcha = await verifyRecaptcha({
    enabled: recaptcha.recaptchaEnabled,
    secretKey: recaptcha.recaptchaSecretKey,
    token: recaptchaToken ?? "",
    remoteIp: ip,
  });
  if (!captcha.ok) {
    return NextResponse.json(
      { code: `RECAPTCHA_${captcha.code}`, error: "Vérification reCAPTCHA refusée." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { code: "EMAIL_TAKEN", error: "Un compte avec cet email existe déjà." },
      { status: 409 },
    );
  }

  // ADR 2026-06-01 (v2-14 Task 7) : check blocage email plateforme. eventId=NULL
  // designe un blocage global (impose par staff). Refus generique anti-enumeration.
  const platformBlocked = await prisma.blockedEmail.findFirst({
    where: { email, eventId: null },
  });
  if (platformBlocked) {
    return NextResponse.json(
      { code: "EMAIL_BLOCKED", error: "Cette adresse ne peut pas etre utilisee." },
      { status: 403 },
    );
  }

  const hashed = await bcrypt.hash(password, 12);
  const plainToken = generateToken();
  const tokenHash = hashToken(plainToken);
  const expiry = computeExpiry(EMAIL_VERIFY_TTL_MS);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name,
      emailVerifyToken: tokenHash,
      emailVerifyTokenExpiry: expiry,
    },
    select: { id: true },
  });

  await sendAccountVerifyEmail(user.id, plainToken, safeInternalPath(parsed.data.next));

  await logActivity({
    type: "USER_REGISTERED",
    userId: user.id,
    targetId: user.id,
    details: { email },
    req,
  });

  return NextResponse.json(
    { ok: true, userId: user.id },
    { status: 201 },
  );
}
