import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { sendBadgePrintedNotification } from "@/lib/mail";

const schema = z.object({ ids: z.array(z.string()).min(1).max(500) });

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const regs = await prisma.registration.findMany({
    where: { id: { in: parsed.data.ids }, eventId, status: "APPROVED" },
    select: { id: true },
  });
  const ids = regs.map((r) => r.id);
  await prisma.registration.updateMany({
    where: { id: { in: ids } },
    data: { badgePrinted: true, badgePrintedAt: new Date() },
  });
  await logActivity({
    type: "BADGE_BATCH_PRINTED",
    userId: session.user.id,
    orgId,
    eventId,
    details: { count: ids.length },
    req,
  });
  for (const id of ids) {
    try {
      await sendBadgePrintedNotification(id);
    } catch (e) {
      console.error("[mail] sendBadgePrintedNotification failed", e);
    }
  }
  return NextResponse.json({ ok: true, printed: ids.length });
});
