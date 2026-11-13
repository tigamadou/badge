import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { parseRegistrationQr } from "@/lib/registration-qr";

const schema = z.object({ payload: z.string().min(1).max(2000) });

export const POST = withEventAuth({ permission: "scan.check-in" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  const badgeId = parseRegistrationQr(parsed.data.payload);
  const reg = await prisma.registration.findUnique({
    where: { id: badgeId },
    select: {
      id: true,
      eventId: true,
      status: true,
      snapshotFirstName: true,
      snapshotLastName: true,
      allAccessGranted: true,
      badgePrinted: true,
      category: { select: { name: true, color: true, number: true } },
    },
  });

  if (!reg) {
    await logActivity({
      type: "BADGE_SCANNED",
      userId: session.user.id,
      orgId,
      eventId,
      details: { result: "not-found", payload: parsed.data.payload },
      req,
    });
    return NextResponse.json(
      { error: "NOT_FOUND", code: "NOT_FOUND", message: "Badge inconnu." },
      { status: 404 },
    );
  }

  if (reg.eventId !== eventId) {
    await logActivity({
      type: "BADGE_SCANNED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: reg.id,
      details: { result: "foreign-event" },
      req,
    });
    return NextResponse.json(
      {
        error: "FOREIGN_EVENT",
        code: "FOREIGN_EVENT",
        message: "Badge appartient à un autre événement.",
      },
      { status: 404 },
    );
  }

  await logActivity({
    type: "BADGE_SCANNED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: reg.id,
    details: { result: reg.status === "APPROVED" ? "ok" : `denied-${reg.status}` },
    req,
  });

  return NextResponse.json({
    ok: true,
    authorized: reg.status === "APPROVED",
    registration: {
      id: reg.id,
      firstName: reg.snapshotFirstName,
      lastName: reg.snapshotLastName,
      status: reg.status,
      allAccessGranted: reg.allAccessGranted,
      badgePrinted: reg.badgePrinted,
      category: reg.category,
    },
  });
});
