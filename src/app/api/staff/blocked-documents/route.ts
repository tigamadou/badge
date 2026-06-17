import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

// ADR 2026-06-01 (v2-14 Task 7) : blocages document au niveau plateforme.

export const GET = withStaffAuth(
  async (req) => {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const rows = await prisma.blockedDocument.findMany({
      where: {
        eventId: null,
        ...(q ? { documentNumber: { contains: q } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ items: rows });
  },
  { minRole: "STAFF_OBSERVER" },
);

const addSchema = z
  .object({
    documentNumber: z.string().trim().min(1).max(80),
    reason: z.string().max(500).optional(),
  })
  .strict();

export const POST = withStaffAuth(
  async (req, { session }) => {
    const json = await req.json().catch(() => null);
    const parsed = addSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const { documentNumber, reason } = parsed.data;

    const existing = await prisma.blockedDocument.findFirst({
      where: { documentNumber, eventId: null },
    });
    if (existing) {
      return NextResponse.json({ ok: true, alreadyBlocked: true });
    }

    const row = await prisma.blockedDocument.create({
      data: { documentNumber, eventId: null, reason: reason ?? null },
    });
    await logActivity({
      type: "PLATFORM_BLOCKED_DOCUMENT_ADDED",
      userId: session.user.id,
      targetId: row.id,
      details: { documentNumber, reason: reason ?? null },
      req,
    });
    return NextResponse.json({ item: row }, { status: 201 });
  },
  { minRole: "STAFF_SUPPORT" },
);
