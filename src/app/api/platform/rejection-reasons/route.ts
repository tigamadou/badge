import { NextResponse } from "next/server";
import { z } from "zod";
import type { RejectionScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

export const GET = withStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const archived = searchParams.get("archived") === "true";
  const scope = searchParams.get("scope");

  const where: { archived: boolean; scope?: { in: RejectionScope[] } } = { archived };
  if (scope === "PROFILE") where.scope = { in: ["PROFILE", "BOTH"] };
  if (scope === "REGISTRATION") where.scope = { in: ["REGISTRATION", "BOTH"] };

  const reasons = await prisma.rejectionReason.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({ reasons });
});

const createSchema = z.object({
  label: z.string().trim().min(1).max(200),
  scope: z.enum(["PROFILE", "REGISTRATION", "BOTH"]),
  sortOrder: z.number().int().min(0).optional(),
});

export const POST = withStaffAuth(
  async (req, { session }) => {
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }
    const reason = await prisma.rejectionReason.create({
      data: {
        label: parsed.data.label,
        scope: parsed.data.scope,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
    });
    await logActivity({
      type: "REJECTION_REASON_CREATED",
      userId: session.user.id,
      targetId: reason.id,
      details: { label: reason.label, scope: reason.scope },
      req,
    });
    return NextResponse.json({ reason }, { status: 201 });
  },
  { minRole: "STAFF_ADMIN" },
);
