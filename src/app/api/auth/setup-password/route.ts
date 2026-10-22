import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { getPlatformRecaptcha } from "@/lib/settings";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { extractClientIp } from "@/lib/rate-limit";

// Schema Zod : token + password (min 6 caracteres, regle metier projet)
const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
  recaptchaToken: z.string().optional(),
});

// Reponse uniforme pour token invalide / expire / user archive : evite l'enumeration.
const INVALID_OR_EXPIRED = {
  code: "INVALID_OR_EXPIRED_TOKEN",
  error: "Lien invalide ou expire",
};

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "INVALID_BODY", error: "Donnees invalides" },
      { status: 400 },
    );
  }

  const { token, password, recaptchaToken } = parsed.data;

  // Avant de consulter l'invitation : un refus ne dit rien sur la validite du lien.
  const recaptcha = await getPlatformRecaptcha();
  const captcha = await verifyRecaptcha({
    enabled: recaptcha.recaptchaEnabled,
    secretKey: recaptcha.recaptchaSecretKey,
    token: recaptchaToken ?? "",
    remoteIp: extractClientIp(req.headers),
  });
  if (!captcha.ok) {
    // La raison donnee par Google n'est lisible que dans les logs serveur.
    console.warn("[recaptcha] verification refusee", {
      route: "setup-password",
      code: captcha.code,
      details: captcha.details,
    });
    return NextResponse.json(
      { code: `RECAPTCHA_${captcha.code}`, error: "Vérification reCAPTCHA refusée." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { inviteToken: token } });
  if (
    !user ||
    !user.inviteTokenExpiry ||
    user.inviteTokenExpiry < new Date() ||
    user.archived
  ) {
    return NextResponse.json(INVALID_OR_EXPIRED, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      inviteToken: null,
      inviteTokenExpiry: null,
      // v2-11 : finaliser l'invitation vaut preuve de possession de l'email.
      // authorize NextAuth refuse les comptes sans emailVerifiedAt -- on le pose ici
      // si pas deja fait pour ne pas bloquer le login des staff invites.
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });

  // Ne jamais inclure le mot de passe (clair ou hash) dans le log
  await logActivity({
    type: "USER_PASSWORD_SET",
    userId: user.id,
    targetId: user.id,
    details: { setupViaInvite: true },
    req,
  });

  return NextResponse.json({ ok: true, email: user.email });
}
