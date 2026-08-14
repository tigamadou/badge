import { NextResponse } from "next/server";
import { z } from "zod";
import { withEventAuth } from "@/lib/with-event-auth";
import { prisma } from "@/lib/prisma";
import { templateExists } from "@/lib/badge-templates/resolve";
import { logActivity } from "@/lib/activity-log";

// v2-12 : PATCH event.badgeTemplateId. requireEventPermission event.settings.update
// (helper geree par withEventAuth + check explicite via hasEventPermission).
const bodySchema = z.object({
  // null pour heriter de l'Organization/PlatformSettings ; string sinon.
  badgeTemplateId: z.string().min(1).nullable(),
});

export const PATCH = withEventAuth(
  { minRole: "VIEWER" },
  async (req, { orgId, eventId, session }) => {
    const { hasEventPermission } = await import("@/lib/auth-helpers");
    const { loadUserContext } = await import("@/lib/user-context");
    // withEventAuth garantit deja session valide + user existant.
    const ctx = (await loadUserContext(session.user.id))!;
    if (!hasEventPermission(ctx, eventId, orgId, "event.settings.update")) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }
    const { badgeTemplateId } = parsed.data;

    if (badgeTemplateId !== null && !(await templateExists(badgeTemplateId))) {
      return NextResponse.json({ error: "UNKNOWN_TEMPLATE" }, { status: 400 });
    }

    await prisma.event.update({
      where: { id: eventId },
      data: { badgeTemplateId },
    });

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
