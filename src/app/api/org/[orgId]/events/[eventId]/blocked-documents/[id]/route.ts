import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

export const DELETE = withEventAuth(
  { permission: "registration.block" },
  async (req, { orgId, eventId, session }, extra) => {
    const { id } = (await extra.params) as { orgId: string; eventId: string; id: string };
    const existing = await prisma.blockedDocument.findUnique({ where: { id } });
    if (!existing || existing.eventId !== eventId) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    await prisma.blockedDocument.delete({ where: { id } });
    await logActivity({
      type: "REGISTRATION_UPDATED",
      userId: session.user.id,
      orgId,
      eventId,
      details: { action: "blocked-document-removed", documentNumber: existing.documentNumber },
      req,
    });
    return new NextResponse(null, { status: 204 });
  },
);
