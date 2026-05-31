import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { sendStatusNotification } from "@/lib/mail";

type Params = { orgId: string; eventId: string; regId: string };

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = (await extra.params) as Params;
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (existing.status === "APPROVED") {
    return NextResponse.json({ ok: true, alreadyApproved: true });
  }

  await prisma.registration.update({
    where: { id: regId },
    data: {
      status: "APPROVED",
      rejectionReason: null,
      rejectionDetails: null,
      editToken: null,
      editTokenExpiresAt: null,
    },
  });

  await logActivity({
    type: "REGISTRATION_APPROVED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    req,
  });

  try {
    await sendStatusNotification(regId);
  } catch (e) {
    console.error("[mail] sendStatusNotification failed", e);
  }

  return NextResponse.json({ ok: true });
});
