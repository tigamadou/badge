import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { sendStatusNotification } from "@/lib/mail";
import { notifyRegistrationDecision } from "@/lib/notifications/triggers";

type Params = { orgId: string; eventId: string; regId: string };

// v4 (plan 08) : le motif provient du catalogue (RejectionReason). Le libelle est
// fige sur la registration ; la cle etrangere est conservee pour les statistiques.
const schema = z.object({
  reasonId: z.string().min(1),
  details: z.string().max(2000).optional(),
});

// ADR 2026-06-01 (v2-14 Task 3) : OPERATOR autorise sur `registration.reject` par la matrice.
export const POST = withEventAuth({ minRole: "OPERATOR" }, async (req, { orgId, eventId, session }, extra) => {
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
  // Un badge imprime est physiquement distribue : le rejet n'a plus de sens.
  if (existing.badgePrinted) {
    return NextResponse.json({ error: "BADGE_ALREADY_PRINTED" }, { status: 409 });
  }

  const reason = await prisma.rejectionReason.findFirst({
    where: { id: parsed.data.reasonId, archived: false },
  });
  if (!reason) {
    return NextResponse.json({ error: "REASON_NOT_FOUND" }, { status: 400 });
  }
  if (reason.scope === "PROFILE") {
    return NextResponse.json({ error: "REASON_WRONG_SCOPE" }, { status: 400 });
  }

  // v2-11 : plus de editToken. La resoumission passe par le compte du participant
  // (/account/registrations/[id]/resubmit). Le mail de rejet pointe vers cette page.
  await prisma.registration.update({
    where: { id: regId },
    data: {
      status: "REJECTED",
      rejectionReasonId: reason.id,
      rejectionReason: reason.label,
      rejectionDetails: parsed.data.details ?? null,
    },
  });

  await logActivity({
    type: "REGISTRATION_REJECTED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { reason: reason.label, hasDetails: !!parsed.data.details },
    req,
  });

  await notifyRegistrationDecision(regId, session.user.id, "REJECTED");

  try {
    await sendStatusNotification(regId);
  } catch (e) {
    console.error("[mail] sendStatusNotification failed", e);
  }

  return NextResponse.json({ ok: true });
});
