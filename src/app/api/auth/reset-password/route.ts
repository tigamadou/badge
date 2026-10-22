import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { hashToken, isExpired } from "@/lib/auth-tokens";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { getPlatformRecaptcha } from "@/lib/settings";
import { verifyRecaptcha } from "@/lib/recaptcha";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6).max(200),
  recaptchaToken: z.string().optional(),
});

const INVALID_OR_EXPIRED = {
  code: "INVALID_OR_EXPIRED_TOKEN",
  error: "Lien invalide ou expiré.",
};

export async function POST(req: NextRequest) {
  const ip = extractClientIp(req.headers);
  const rate = checkRateLimit(ip, "auth-reset-password", { windowMs: 60_000, max: 10 });
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

  // Avant de consulter le lien : un refus ne renseigne pas sur sa validite.
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
      route: "reset-password",
      code: captcha.code,
      details: captcha.details,
    });
    return NextResponse.json(
      { code: `RECAPTCHA_${captcha.code}`, error: "Vérification reCAPTCHA refusée." },
      { status: 400 },
    );
  }

  const tokenHash = hashToken(parsed.data.token);
  const user = await prisma.user.findUnique({
    where: { passwordResetToken: tokenHash },
    select: {
      id: true,
      archived: true,
      blocked: true,
      passwordResetExpiry: true,
    },
  });

  if (!user || user.archived || user.blocked || isExpired(user.passwordResetExpiry)) {
    return NextResponse.json(INVALID_OR_EXPIRED, { status: 400 });
  }

  const hashed = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
  });

  await logActivity({
    type: "USER_PASSWORD_RESET_COMPLETED",
    userId: user.id,
    targetId: user.id,
    req,
  });

  return NextResponse.json({ ok: true });
}
