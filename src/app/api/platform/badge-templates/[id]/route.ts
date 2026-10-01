import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireStaff, AuthError } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

export const runtime = "nodejs";

// `.strict()` : l'immuabilite du layout est appliquee par le validateur, pas seulement
// par convention. Une tentative de modifier layout, family ou assetPrefix est refusee.
const bodySchema = z.object({ archived: z.boolean() }).strict();

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
}
