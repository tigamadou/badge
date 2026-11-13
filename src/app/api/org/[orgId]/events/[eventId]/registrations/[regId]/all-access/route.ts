import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

type Params = { orgId: string; eventId: string; regId: string };

const schema = z.object({ allAccessGranted: z.boolean() });

export const POST = withEventAuth({ permission: "registration.all_access" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = (await extra.params) as Params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.registration.update({
    where: { id: regId },
    data: { allAccessGranted: parsed.data.allAccessGranted },
  });
  await logActivity({
    type: "BADGE_ALL_ACCESS_TOGGLED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { value: parsed.data.allAccessGranted },
    req,
  });
  return NextResponse.json({ ok: true });
});
