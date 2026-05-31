import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { generateEditToken } from "@/lib/edit-token";

type Params = { orgId: string; eventId: string; regId: string };

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = (await extra.params) as Params;
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const { token, expiresAt } = generateEditToken();
  await prisma.registration.update({
    where: { id: regId },
    data: { editToken: token, editTokenExpiresAt: expiresAt },
  });
  await logActivity({
    type: "EDIT_LINK_SENT",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { resetOnly: true },
    req,
  });
  return NextResponse.json({ ok: true, token });
});
