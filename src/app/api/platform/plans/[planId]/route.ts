import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  maxEvents: z.number().int().min(0).nullable().optional(),
  maxParticipantsPerEvent: z.number().int().min(0).nullable().optional(),
  archived: z.boolean().optional(),
});

export const PATCH = withStaffAuth<{ planId: string }>(
  async (req, { session }, { params }) => {
    const { planId } = await params;
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    try {
      const plan = await prisma.plan.update({
        where: { id: planId },
        data: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.maxEvents !== undefined && { maxEvents: data.maxEvents }),
          ...(data.maxParticipantsPerEvent !== undefined && {
            maxParticipantsPerEvent: data.maxParticipantsPerEvent,
          }),
          ...(data.archived !== undefined && { archived: data.archived }),
        },
      });
      await logActivity({
        type: "PLAN_UPDATED",
        userId: session.user.id,
        targetId: plan.id,
        details: {
          name: plan.name,
          maxEvents: plan.maxEvents,
          maxParticipantsPerEvent: plan.maxParticipantsPerEvent,
          archived: plan.archived,
        },
        req,
      });
      return NextResponse.json({ plan });
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "P2025") {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }
      if (e.code === "P2002") {
        return NextResponse.json({ error: "NAME_TAKEN" }, { status: 409 });
      }
      throw err;
    }
  },
  { minRole: "STAFF_ADMIN" },
);
