import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { generateQRCodePng } from "@/lib/qrcode";
import { registrationVerifyUrl } from "@/lib/registration-qr";
import { buildBaseUrl } from "@/lib/mail-helpers";

export const runtime = "nodejs";

// Image hébergée du QR d'accueil (les clients mail bloquent les images data:).
// Ne contient que l'URL publique /verify/<id> : aucune donnée personnelle.
export async function GET(req: Request, ctx: { params: Promise<{ registrationId: string }> }) {
  const { registrationId } = await ctx.params;
  const ip = extractClientIp(new Headers(req.headers));
  const rl = checkRateLimit(ip, "public-qr", { max: 300 });
  if (!rl.ok) {
    // Les proxys d'images des clients mail rejouent beaucoup de requêtes depuis une même IP.
    return NextResponse.json(
      { error: "Rate limited", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { id: true, status: true },
  });
  if (!registration || registration.status !== "APPROVED") {
    return NextResponse.json({ error: "NOT_FOUND", code: "NOT_FOUND" }, { status: 404 });
  }

  const baseUrl = buildBaseUrl({
    BASE_URL: process.env.BASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  });
  const png = await generateQRCodePng(registrationVerifyUrl(baseUrl, registration.id));
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
