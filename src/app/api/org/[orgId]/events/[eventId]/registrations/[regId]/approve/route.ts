import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { sendStatusNotification } from "@/lib/mail";
import { notifyRegistrationDecision } from "@/lib/notifications/triggers";

type Params = { orgId: string; eventId: string; regId: string };

// ADR 2026-06-01 (v2-14 Task 3) : OPERATOR autorise sur `registration.approve` par la matrice.
// Auparavant `minRole: "ADMIN"` -- divergent de la spec espace-evenement (critere #2).
export const POST = withEventAuth({ minRole: "OPERATOR" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = (await extra.params) as Params;
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (existing.status === "APPROVED") {
    return NextResponse.json({ ok: true, alreadyApproved: true });
  }

  // v4 (plan 08) : gel. L'organisation ne peut approuver une inscription que si le
  // profil du participant est valide par la plateforme.
  const participant = await prisma.user.findUnique({
    where: { id: existing.userId },
    select: { profileStatus: true },
  });
  if (participant?.profileStatus !== "APPROVED") {
    return NextResponse.json({ error: "PROFILE_NOT_APPROVED" }, { status: 409 });
  }

  await prisma.registration.update({
    where: { id: regId },
    data: {
      status: "APPROVED",
      rejectionReason: null,
      rejectionDetails: null,
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

  await notifyRegistrationDecision(regId, session.user.id, "APPROVED");

  try {
    await sendStatusNotification(regId);
  } catch (e) {
    console.error("[mail] sendStatusNotification failed", e);
  }

  return NextResponse.json({ ok: true });
});
