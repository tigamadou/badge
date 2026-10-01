import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { hashToken, isExpired } from "@/lib/auth-tokens";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6).max(200),
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
