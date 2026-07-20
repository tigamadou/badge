import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

export const GET = withStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const archived = searchParams.get("archived") === "true";
  const plans = await prisma.plan.findMany({
    where: { archived },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { subscriptions: true } } },
  });
  return NextResponse.json({ plans });
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  period: z.enum(["MONTHLY", "ANNUAL"]).optional(),
  maxEvents: z.number().int().min(0).nullable().optional(),
  maxParticipantsPerEvent: z.number().int().min(0).nullable().optional(),
});

export const POST = withStaffAuth(
  async (req, { session }) => {
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { name, period, maxEvents, maxParticipantsPerEvent } = parsed.data;

    try {
      const plan = await prisma.plan.create({
        data: {
          name: name.trim(),
          period: period ?? "MONTHLY",
          maxEvents: maxEvents ?? null,
          maxParticipantsPerEvent: maxParticipantsPerEvent ?? null,
        },
      });
      await logActivity({
        type: "PLAN_CREATED",
        userId: session.user.id,
        targetId: plan.id,
        details: { name: plan.name, period: plan.period, maxEvents: plan.maxEvents, maxParticipantsPerEvent: plan.maxParticipantsPerEvent },
        req,
      });
      return NextResponse.json({ plan }, { status: 201 });
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "P2002") {
        return NextResponse.json({ error: "NAME_TAKEN" }, { status: 409 });
      }
      throw err;
    }
  },
  { minRole: "STAFF_ADMIN" },
);
