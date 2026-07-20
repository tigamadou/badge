import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { consumeEmailVerifyToken } from "@/lib/verify-email";
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

  // Logique partagee avec la page /verify-email/[token] (source unique).
  const result = await consumeEmailVerifyToken(parsed.data.token, { req });

  if (result.status === "invalid-or-expired") {
    return NextResponse.json(INVALID_OR_EXPIRED, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    ...(result.status === "already-verified" ? { alreadyVerified: true } : {}),
  });
}
