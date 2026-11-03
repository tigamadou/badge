import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireOrgRole, AuthError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { templateExists } from "@/lib/badge-templates/resolve";
import { logActivity } from "@/lib/activity-log";
import { pinLockedEventTemplates, syncRequestTemplates } from "@/lib/print-requests/template-lock";
import { notifyPrintRequestStatusChanged } from "@/lib/notifications/triggers";

// v2-12 : PATCH organization.badgeTemplateId.
// Note (2026-05-31) : OrgSettings supprime -- le champ vit sur Organization.
// Log via ORG_UPDATED (pas d'ORG_SETTINGS_UPDATED dans l'enum v2).
const bodySchema = z.object({
  badgeTemplateId: z.string().min(1).nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }
  try {
    // OWNER ou MANAGER (hierarchie : MANAGER satisfait via requireOrgRole MANAGER).
    await requireOrgRole(session.user.id, orgId, "MANAGER");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    }
    throw err;
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

  // Les évènements verrouillés gardent leur template : épinglés dans la même transaction.
  await prisma.$transaction(async (tx) => {
    await pinLockedEventTemplates({ orgId }, tx);
    await tx.organization.update({ where: { id: orgId }, data: { badgeTemplateId } });
  });

  const resubmitted = await syncRequestTemplates({ orgId }, session.user.id);
  for (const id of resubmitted) {
    await notifyPrintRequestStatusChanged(id, session.user.id, { organizer: true, staff: true });
  }

  await logActivity({
    type: "ORG_UPDATED",
    userId: session.user.id,
    orgId,
    details: { field: "badgeTemplateId", value: badgeTemplateId },
    req,
  });

  return NextResponse.json({ ok: true, badgeTemplateId });
}
