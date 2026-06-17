import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { sendBadgePrintedNotification } from "@/lib/mail";

type Params = { orgId: string; eventId: string; regId: string };

// ADR 2026-06-01 (v2-14 Task 3) : permission badge.print = ADMIN + OPERATOR + PRINTER.
// `minRole: "PRINTER"` couvre exactement ce besoin via la hierarchie partielle de
// requireEventRole (ADMIN+OPERATOR englobent PRINTER ; VIEWER reste exclu).
export const POST = withEventAuth({ minRole: "PRINTER" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = (await extra.params) as Params;
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (existing.status !== "APPROVED") {
    return NextResponse.json(
      {
        error: "NOT_APPROVED",
        code: "NOT_APPROVED",
        message: "Seules les inscriptions approuvées peuvent être imprimées.",
      },
      { status: 409 },
    );
  }

  await prisma.registration.update({
    where: { id: regId },
    data: { badgePrinted: true, badgePrintedAt: new Date() },
  });

  await logActivity({
    type: "BADGE_PRINTED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    req,
  });

  try {
    await sendBadgePrintedNotification(regId);
  } catch (e) {
    console.error("[mail] sendBadgePrintedNotification failed", e);
  }

  return NextResponse.json({ ok: true });
});
