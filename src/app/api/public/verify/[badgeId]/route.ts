import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ badgeId: string }> }) {
  const { badgeId } = await ctx.params;
  const ip = extractClientIp(new Headers(req.headers));
  const rl = checkRateLimit(ip, "public-verify");
  if (!rl.ok) return NextResponse.json({ error: "Rate limited", code: "RATE_LIMITED" }, { status: 429 });

  const registration = await prisma.registration.findUnique({
    where: { id: badgeId },
    include: {
      category: { select: { id: true, name: true, color: true, anonymous: true } },
      event: { select: { id: true, title: true, date: true, slug: true, archived: true } },
    },
  });
  if (!registration) return NextResponse.json({ valid: false, code: "NOT_FOUND" }, { status: 404 });

  const valid = registration.status === "APPROVED" && registration.badgePrinted;

  await logActivity({
    type: "BADGE_SCANNED",
    eventId: registration.eventId,
    targetId: registration.id,
    details: { valid, source: "public-verify" },
    req: req as unknown as NextRequest,
  });

  if (!valid) {
    return NextResponse.json({
      valid: false,
      event: { title: registration.event.title, date: registration.event.date },
    });
  }

  const cat = registration.category;
  const base = {
    valid: true as const,
    event: { title: registration.event.title, date: registration.event.date },
    category: { id: cat.id, name: cat.name, color: cat.color, anonymous: cat.anonymous },
  };
  if (cat.anonymous) return NextResponse.json(base);
  return NextResponse.json({
    ...base,
    participant: {
      firstName: registration.firstName,
      lastName: registration.lastName,
      structure: registration.structure,
    },
  });
}
