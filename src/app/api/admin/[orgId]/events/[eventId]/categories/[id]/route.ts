import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  number: z.number().int().min(0).max(999).optional(),
  neutralBadge: z.boolean().optional(),
  anonymous: z.boolean().optional(),
  reassignToCategoryId: z.string().optional(),
});

export const PATCH = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { id } = (await extra.params) as { orgId: string; eventId: string; id: string };
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { reassignToCategoryId, ...updates } = parsed.data;

  if (reassignToCategoryId) {
    const target = await prisma.category.findUnique({ where: { id: reassignToCategoryId } });
    if (!target || target.eventId !== eventId || target.id === id) {
      return NextResponse.json({ error: "INVALID_TARGET" }, { status: 400 });
    }
    await prisma.registration.updateMany({
      where: { categoryId: id },
      data: { categoryId: reassignToCategoryId },
    });
  }

  if (Object.keys(updates).length === 0 && !reassignToCategoryId) {
    return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
  }

  try {
    const category = Object.keys(updates).length
      ? await prisma.category.update({ where: { id }, data: updates })
      : await prisma.category.findUnique({ where: { id } });

    await logActivity({
      type: "CATEGORY_UPDATED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: id,
      details: { changedFields: Object.keys(parsed.data) },
      req,
    });
    return NextResponse.json({ category });
  } catch (err) {
    const e = err as { code?: string; meta?: { target?: unknown } };
    if (e.code === "P2002") {
      const rawTarget = e.meta?.target;
      const targetStr = Array.isArray(rawTarget) ? rawTarget.join(",") : String(rawTarget ?? "");
      const code = targetStr.includes("number") ? "NUMBER_TAKEN" : "CONFLICT";
      return NextResponse.json({ error: code, code }, { status: 409 });
    }
    throw err;
  }
});

export const DELETE = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { id } = (await extra.params) as { orgId: string; eventId: string; id: string };
  const existing = await prisma.category.findUnique({
    where: { id },
    select: { id: true, eventId: true, name: true, _count: { select: { registrations: true } } },
  });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (existing._count.registrations > 0) {
    return NextResponse.json(
      {
        error: "CATEGORY_HAS_REGISTRATIONS",
        code: "CATEGORY_HAS_REGISTRATIONS",
        count: existing._count.registrations,
        message: "Réaffectez les inscriptions à une autre catégorie avant de supprimer.",
      },
      { status: 409 },
    );
  }

  await prisma.category.delete({ where: { id } });
  await logActivity({
    type: "CATEGORY_DELETED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: id,
    details: { name: existing.name },
    req,
  });
  return new NextResponse(null, { status: 204 });
});
