import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export const runtime = "nodejs";

// `.strict()` : l'immuabilite du layout est appliquee par le validateur, pas seulement
// par convention. Une tentative de modifier layout, family ou assetPrefix est refusee.
const bodySchema = z.object({ archived: z.boolean() }).strict();

export const PATCH = withStaffAuth<{ id: string }>(
  async (req: NextRequest, { session }, ctx) => {
  const { id } = await ctx.params;
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const existing = await prisma.installedBadgeTemplate.findUnique({
    where: { id },
    select: { id: true, family: true, version: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { archived } = parsed.data;
  // Les ressources ne sont PAS supprimees : un template archive doit rester
  // resolvable pour les evenements qui le referencent, sinon leurs badges changeraient.
  await prisma.installedBadgeTemplate.update({
    where: { id },
    data: { archived, archivedAt: archived ? new Date() : null },
  });

  await logActivity({
    type: "BADGE_TEMPLATE_ARCHIVED",
    userId: session.user.id as string,
    targetId: id,
    details: { family: existing.family, version: existing.version, archived },
    req,
  });

  return NextResponse.json({ ok: true, archived });
},
  { permission: "badge_templates.manage" },
);
