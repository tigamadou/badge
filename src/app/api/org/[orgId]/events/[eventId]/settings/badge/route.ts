import { NextResponse } from "next/server";
import { z } from "zod";
import { withEventAuth } from "@/lib/with-event-auth";
import { prisma } from "@/lib/prisma";
import { templateExists } from "@/lib/badge-templates/resolve";
import { logActivity } from "@/lib/activity-log";
import { printRequestErrorResponse } from "@/lib/print-requests/errors";
import { lockEventRow } from "@/lib/print-requests/content";
import { assertTemplateChangeAllowed, syncRequestTemplates } from "@/lib/print-requests/template-lock";
import { notifyPrintRequestStatusChanged } from "@/lib/notifications/triggers";

// v2-12 : PATCH event.badgeTemplateId, permission `event.settings.update`.
const bodySchema = z.object({
  // null pour heriter de l'Organization/PlatformSettings ; string sinon.
  badgeTemplateId: z.string().min(1).nullable(),
});

export const PATCH = withEventAuth(
  { permission: "event.settings.update" },
  async (req, { orgId, eventId, session }) => {
    const raw = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }
    const { badgeTemplateId } = parsed.data;

    if (badgeTemplateId !== null && !(await templateExists(badgeTemplateId))) {
      return NextResponse.json({ error: "UNKNOWN_TEMPLATE" }, { status: 400 });
    }

    // Verrou de l'évènement puis contrôle et écriture dans la même transaction.
    try {
      await prisma.$transaction(async (tx) => {
        await lockEventRow(tx, eventId);
        await assertTemplateChangeAllowed(eventId, tx);
        await tx.event.update({ where: { id: eventId }, data: { badgeTemplateId } });
      });
    } catch (err) {
      return printRequestErrorResponse(err);
    }
    const resubmitted = await syncRequestTemplates({ eventId }, session.user.id);
    for (const id of resubmitted) {
      await notifyPrintRequestStatusChanged(id, session.user.id, { organizer: true, staff: true });
    }

    await logActivity({
      type: "EVENT_SETTINGS_UPDATED",
      userId: session.user.id,
      orgId,
      eventId,
      details: { field: "badgeTemplateId", value: badgeTemplateId },
      req,
    });

    return NextResponse.json({ ok: true, badgeTemplateId });
  },
);
