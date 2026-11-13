import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

type Params = { orgId: string; eventId: string; regId: string };

const schema = z.object({ reason: z.string().max(500).optional() });

export const POST = withEventAuth({ permission: "registration.block" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = (await extra.params) as Params;
  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  const reason = parsed.success ? parsed.data.reason ?? null : null;

  const reg = await prisma.registration.findUnique({ where: { id: regId } });
  if (!reg || reg.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    await prisma.blockedEmail.create({
      data: { eventId, email: reg.snapshotEmail, reason },
    });
  } catch (err) {
    if ((err as { code?: string }).code !== "P2002") throw err;
  }
  await logActivity({
    type: "REGISTRATION_UPDATED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { action: "block-email", email: reg.snapshotEmail, reason },
    req,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
});
