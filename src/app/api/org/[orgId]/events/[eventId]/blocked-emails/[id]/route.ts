import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

export const DELETE = withEventAuth(
  { minRole: "ADMIN" },
  async (req, { orgId, eventId, session }, extra) => {
    const { id } = (await extra.params) as { orgId: string; eventId: string; id: string };
    const existing = await prisma.blockedEmail.findUnique({ where: { id } });
    if (!existing || existing.eventId !== eventId) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    await prisma.blockedEmail.delete({ where: { id } });
    await logActivity({
      type: "REGISTRATION_UPDATED",
      userId: session.user.id,
      orgId,
      eventId,
      details: { action: "blocked-email-removed", email: existing.email },
      req,
    });
    return new NextResponse(null, { status: 204 });
  },
);
