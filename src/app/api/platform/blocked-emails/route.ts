import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

// ADR 2026-06-01 (v2-14 Task 7) : blocages email au niveau plateforme (eventId=null).
// Lecture STAFF_OBSERVER+, ajout STAFF_SUPPORT+.

export const GET = withStaffAuth(
  async (req) => {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const rows = await prisma.blockedEmail.findMany({
      where: {
        eventId: null,
        ...(q ? { email: { contains: q } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ items: rows });
  },
  { permission: "blocklist.read" },
);

const addSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((s) => s.toLowerCase().trim()),
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
    const { email, reason } = parsed.data;

    const existing = await prisma.blockedEmail.findFirst({
      where: { email, eventId: null },
    });
    if (existing) {
      return NextResponse.json({ ok: true, alreadyBlocked: true });
    }

    const row = await prisma.blockedEmail.create({
      data: { email, eventId: null, reason: reason ?? null },
    });
    await logActivity({
      type: "PLATFORM_BLOCKED_EMAIL_ADDED",
      userId: session.user.id,
      targetId: row.id,
      details: { email, reason: reason ?? null },
      req,
    });
    return NextResponse.json({ item: row }, { status: 201 });
  },
  { permission: "blocklist.manage" },
);
