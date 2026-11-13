import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { sendPasswordResetEmail } from "@/lib/mail";

export const POST = withStaffAuth<{ userId: string }>(
  async (req, { session }, extra) => {
    const { userId } = await extra.params;
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, archived: true },
    });
    if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (target.archived) {
      return NextResponse.json({ error: "USER_ARCHIVED" }, { status: 400 });
    }

    // Genere un inviteToken (24h) sur le User. L'envoi reel viendra du Plan 6.
    await sendPasswordResetEmail(userId);

    await logActivity({
      type: "USER_PASSWORD_SET",
      userId: session.user.id,
      targetId: userId,
      details: { resetByStaff: true },
      req,
    });

    return NextResponse.json({ ok: true });
  },
  { permission: "users.password.reset" },
);
