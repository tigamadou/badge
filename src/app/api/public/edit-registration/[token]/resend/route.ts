import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { sendEditLinkEmail } from "@/lib/mail";

const COOLDOWN_MS = 60_000;
const cooldownByReg = new Map<string, number>();
const EDIT_TOKEN_TTL_MS = 48 * 3600 * 1000;

export const runtime = "nodejs";

export function resetEditResendCooldownForTests(): void {
  cooldownByReg.clear();
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ip = extractClientIp(new Headers(req.headers));

  const rl = checkRateLimit(ip, "public-edit-resend");
  if (!rl.ok) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });

  const reg = await prisma.registration.findUnique({ where: { editToken: token } });
  if (!reg) return NextResponse.json({ ok: true }); // anti-enumeration

  const lastAt = cooldownByReg.get(reg.id) ?? 0;
  if (Date.now() - lastAt < COOLDOWN_MS) {
    return NextResponse.json({ code: "COOLDOWN" }, { status: 429 });
  }
  cooldownByReg.set(reg.id, Date.now());

  const newToken = randomBytes(32).toString("hex");
  await prisma.registration.update({
    where: { id: reg.id },
    data: {
      editToken: newToken,
      editTokenExpiresAt: new Date(Date.now() + EDIT_TOKEN_TTL_MS),
    },
  });
  await logActivity({
    type: "EDIT_LINK_SENT",
    eventId: reg.eventId,
    targetId: reg.id,
    req: req as unknown as NextRequest,
  });
  sendEditLinkEmail(reg.id).catch((err) => console.error("[mail] resend edit-link failed", err));
  return NextResponse.json({ ok: true });
}
