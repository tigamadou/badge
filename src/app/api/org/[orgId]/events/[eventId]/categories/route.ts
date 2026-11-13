import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

export const GET = withEventAuth({ permission: "event.read.detailed", allowArchived: true }, async (_req, { eventId }) => {
  const categories = await prisma.category.findMany({
    where: { eventId },
    orderBy: [{ number: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      number: true,
      neutralBadge: true,
      anonymous: true,
      _count: { select: { registrations: true } },
    },
  });
  return NextResponse.json({ categories });
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  number: z.number().int().min(0).max(999),
  neutralBadge: z.boolean().optional(),
  anonymous: z.boolean().optional(),
});

export const POST = withEventAuth({ permission: "event.categories.manage" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const category = await prisma.category.create({
      data: { eventId, ...parsed.data },
    });
    await logActivity({
      type: "CATEGORY_CREATED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: category.id,
      details: { name: parsed.data.name, number: parsed.data.number },
      req,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    const e = err as { code?: string; meta?: { target?: unknown } };
    if (e.code === "P2002") {
      const rawTarget = e.meta?.target;
      const targetStr = Array.isArray(rawTarget) ? rawTarget.join(",") : String(rawTarget ?? "");
      const code = targetStr.includes("number")
        ? "NUMBER_TAKEN"
        : targetStr.includes("name")
        ? "NAME_TAKEN"
        : "CONFLICT";
      return NextResponse.json({ error: code, code }, { status: 409 });
    }
    throw err;
  }
});
