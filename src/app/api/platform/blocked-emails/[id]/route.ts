import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

// ADR 2026-06-01 (v2-14 Task 7) : retrait blocage email plateforme.

export const DELETE = withStaffAuth(
  async (req, { session }, { params }) => {
    const { id } = await params;
    const existing = await prisma.blockedEmail.findUnique({ where: { id } });
    if (!existing || existing.eventId !== null) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    await prisma.blockedEmail.delete({ where: { id } });
    await logActivity({
      type: "PLATFORM_BLOCKED_EMAIL_REMOVED",
      userId: session.user.id,
      targetId: id,
      details: { email: existing.email },
      req,
    });
    return new NextResponse(null, { status: 204 });
  },
  { permission: "blocklist.manage" },
);
