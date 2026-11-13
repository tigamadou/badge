import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { prisma } from "@/lib/prisma";
import { templateExists } from "@/lib/badge-templates/resolve";
import { logActivity } from "@/lib/activity-log";
import { pinLockedEventTemplates, syncRequestTemplates } from "@/lib/print-requests/template-lock";
import { notifyPrintRequestStatusChanged } from "@/lib/notifications/triggers";

// v2-12 : PATCH platformSettings.badgeTemplateId.
// Racine de la cascade : NOT NULL en BDD, on refuse null cote validation.
const bodySchema = z.object({
  badgeTemplateId: z.string().min(1),
});

export const PATCH = withStaffAuth(
  async (req: NextRequest, { session }) => {
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const { badgeTemplateId } = parsed.data;

  if (!(await templateExists(badgeTemplateId))) {
    return NextResponse.json({ error: "UNKNOWN_TEMPLATE" }, { status: 400 });
  }

  // Les évènements verrouillés gardent leur template : épinglés dans la même transaction.
  await prisma.$transaction(async (tx) => {
    await pinLockedEventTemplates({ platform: true }, tx);
    await tx.platformSettings.update({ where: { id: "singleton" }, data: { badgeTemplateId } });
  });

  const resubmitted = await syncRequestTemplates({ platform: true }, session.user.id);
  for (const id of resubmitted) {
    await notifyPrintRequestStatusChanged(id, session.user.id, { organizer: true, staff: true });
  }

  await logActivity({
    type: "PLATFORM_SETTINGS_UPDATED",
    userId: session.user.id,
    details: { field: "badgeTemplateId", value: badgeTemplateId },
    req,
  });

  return NextResponse.json({ ok: true, badgeTemplateId });
},
  { permission: "settings.badge_template.update" },
);
