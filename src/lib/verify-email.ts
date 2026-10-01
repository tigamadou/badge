import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { hashToken, isExpired } from "@/lib/auth-tokens";

export type VerifyEmailResult =
  | { status: "verified" }
  | { status: "already-verified" }
  | { status: "invalid-or-expired" };

// Consomme un token de verification d'email. Logique partagee par la page
// /verify-email/[token] (Server Component) et la route API : la page appelle ce
// helper directement, sans self-fetch HTTP (injoignable en conteneur).
// Reponse uniforme pour token invalide/expire : evite l'enumeration des tokens.
export async function consumeEmailVerifyToken(
  token: string,
  opts?: { req?: NextRequest },
): Promise<VerifyEmailResult> {
  const tokenHash = hashToken(token);
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

  if (!user || user.archived || user.blocked || isExpired(user.emailVerifyTokenExpiry)) {
    return { status: "invalid-or-expired" };
  }

  // Idempotent : si deja verifie on nettoie le token sans relog.
  if (user.emailVerifiedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: null, emailVerifyTokenExpiry: null },
    });
    return { status: "already-verified" };
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
    req: opts?.req,
  });

  return { status: "verified" };
}
