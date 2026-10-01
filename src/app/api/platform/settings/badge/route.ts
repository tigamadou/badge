import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireStaff, AuthError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { templateExists } from "@/lib/badge-templates/resolve";
import { logActivity } from "@/lib/activity-log";

// v2-12 : PATCH platformSettings.badgeTemplateId.
// Racine de la cascade : NOT NULL en BDD, on refuse null cote validation.
const bodySchema = z.object({
  badgeTemplateId: z.string().min(1),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }
  try {
    await requireStaff(session.user.id, "STAFF_ADMIN");
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

  if (!(await templateExists(badgeTemplateId))) {
    return NextResponse.json({ error: "UNKNOWN_TEMPLATE" }, { status: 400 });
  }

  await prisma.platformSettings.update({
    where: { id: "singleton" },
    data: { badgeTemplateId },
  });

  await logActivity({
    type: "PLATFORM_SETTINGS_UPDATED",
    userId: session.user.id,
    details: { field: "badgeTemplateId", value: badgeTemplateId },
    req,
  });

  return NextResponse.json({ ok: true, badgeTemplateId });
}
