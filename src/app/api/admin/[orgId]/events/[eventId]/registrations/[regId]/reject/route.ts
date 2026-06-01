import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { sendStatusNotification } from "@/lib/mail";

type Params = { orgId: string; eventId: string; regId: string };

const schema = z.object({
  reason: z.string().min(1).max(200),
  details: z.string().max(2000).optional(),
});

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = (await extra.params) as Params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // v2-11 : plus de editToken. La resoumission passe par le compte du participant
  // (/account/registrations/[id]/resubmit). Le mail de rejet pointe vers cette page.
  await prisma.registration.update({
    where: { id: regId },
    data: {
      status: "REJECTED",
      rejectionReason: parsed.data.reason,
      rejectionDetails: parsed.data.details ?? null,
    },
  });

  await logActivity({
    type: "REGISTRATION_REJECTED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { reason: parsed.data.reason, hasDetails: !!parsed.data.details },
    req,
  });

  try {
    await sendStatusNotification(regId);
  } catch (e) {
    console.error("[mail] sendStatusNotification failed", e);
  }

  return NextResponse.json({ ok: true });
});
