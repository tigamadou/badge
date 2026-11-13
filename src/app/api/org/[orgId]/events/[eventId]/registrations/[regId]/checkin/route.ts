import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

type Params = { orgId: string; eventId: string; regId: string };

export const POST = withEventAuth({ permission: "scan.check-in" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = (await extra.params) as Params;
  const reg = await prisma.registration.findUnique({
    where: { id: regId },
    select: { id: true, eventId: true, status: true, snapshotFirstName: true, snapshotLastName: true, badgePrinted: true },
  });
  if (!reg || reg.eventId !== eventId) {
    return NextResponse.json(
      { error: "NOT_FOUND", code: "FOREIGN_EVENT", message: "Badge appartient à un autre événement" },
      { status: 404 },
    );
  }

  await logActivity({
    type: "BADGE_SCANNED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    req,
  });

  const authorized = reg.status === "APPROVED";
  return NextResponse.json({
    ok: true,
    registration: {
      id: reg.id,
      firstName: reg.snapshotFirstName,
      lastName: reg.snapshotLastName,
      status: reg.status,
      badgePrinted: reg.badgePrinted,
    },
    authorized,
  });
});
