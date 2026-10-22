import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { getPlatformRecaptcha } from "@/lib/settings";
import { verifyRecaptcha } from "@/lib/recaptcha";
import {
  generateToken,
  hashToken,
  computeExpiry,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/auth-tokens";
import { sendAccountPasswordReset } from "@/lib/mail";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().email().max(254),
  recaptchaToken: z.string().optional(),
});

// Reponse uniforme anti-enumeration : on renvoie toujours 200 que l'email existe ou non.
// Si l'email existe, on genere le token et on envoie le mail (best effort).
export async function POST(req: NextRequest) {
  const ip = extractClientIp(req.headers);
  const rate = checkRateLimit(ip, "auth-forgot-password", { windowMs: 60_000, max: 5 });
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

  const recaptcha = await getPlatformRecaptcha();
  const captcha = await verifyRecaptcha({
    enabled: recaptcha.recaptchaEnabled,
    secretKey: recaptcha.recaptchaSecretKey,
    token: parsed.data.recaptchaToken ?? "",
    remoteIp: ip,
  });
  if (!captcha.ok) {
    // La reponse ne porte que le code ; la raison donnee par Google (cle invalide, domaine non
    // autorise...) n'est lisible que dans les logs serveur.
    console.warn("[recaptcha] verification refusee", { route: "forgot-password", code: captcha.code, details: captcha.details });
    return NextResponse.json(
      { code: `RECAPTCHA_${captcha.code}`, error: "Vérification reCAPTCHA refusée." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, archived: true, blocked: true, emailVerifiedAt: true },
  });

  // Genere token + mail uniquement si compte existant, actif, verifie. Toujours 200.
  if (user && !user.archived && !user.blocked && user.emailVerifiedAt) {
    const plainToken = generateToken();
    const tokenHash = hashToken(plainToken);
    const expiry = computeExpiry(PASSWORD_RESET_TTL_MS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpiry: expiry,
      },
    });

    await sendAccountPasswordReset(user.id, plainToken);
    await logActivity({
      type: "USER_PASSWORD_RESET_REQUESTED",
      userId: user.id,
      targetId: user.id,
      req,
    });
  }

  return NextResponse.json({ ok: true });
}
