import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { hashToken, isExpired } from "@/lib/auth-tokens";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  token: z.string().min(1),
});

// Reponse uniforme pour token invalide / expire : evite l'enumeration des tokens valides.
const INVALID_OR_EXPIRED = {
  code: "INVALID_OR_EXPIRED_TOKEN",
  error: "Lien invalide ou expiré.",
};

export async function POST(req: NextRequest) {
  const ip = extractClientIp(req.headers);
  const rate = checkRateLimit(ip, "auth-verify-email", { windowMs: 60_000, max: 20 });
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

  const tokenHash = hashToken(parsed.data.token);
  const user = await prisma.user.findUnique({
    where: { emailVerifyToken: tokenHash },
    select: {
      id: true,
      emailVerifiedAt: true,
      emailVerifyTokenExpiry: true,
      archived: true,
      blocked: true,
    },
  });

  if (!user || user.archived || isExpired(user.emailVerifyTokenExpiry)) {
    return NextResponse.json(INVALID_OR_EXPIRED, { status: 400 });
  }

  // Idempotent : si deja verifie on renvoie 200 sans relog.
  if (user.emailVerifiedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: null, emailVerifyTokenExpiry: null },
    });
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerifyToken: null,
      emailVerifyTokenExpiry: null,
    },
  });

  await logActivity({
    type: "USER_EMAIL_VERIFIED",
    userId: user.id,
    targetId: user.id,
    req,
  });

  return NextResponse.json({ ok: true });
}
