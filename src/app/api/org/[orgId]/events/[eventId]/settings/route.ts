import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { resolvePublicSettings } from "@/lib/settings";

export const GET = withEventAuth({ permission: "event.settings.update", allowArchived: true }, async (_req, { eventId }) => {
  const settings = await prisma.eventSettings.findUnique({ where: { eventId } });
  const resolved = await resolvePublicSettings(eventId);
  return NextResponse.json({
    settings: settings
      ? { contactEmail: settings.contactEmail, contactPhone: settings.contactPhone }
      : {},
    resolved,
  });
});

const patchSchema = z
  .object({
    contactEmail: z.string().email().nullable().optional(),
    contactPhone: z.string().max(40).nullable().optional(),
  })
  .strict();

export const PATCH = withEventAuth({ permission: "event.settings.update" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;
  await prisma.eventSettings.upsert({
    where: { eventId },
    create: { eventId, ...data },
    update: data,
  });

  await logActivity({
    type: "EVENT_SETTINGS_UPDATED",
    userId: session.user.id,
    orgId,
    eventId,
    details: { changedFields: Object.keys(data) },
    req,
  });

  return NextResponse.json({ ok: true });
});
