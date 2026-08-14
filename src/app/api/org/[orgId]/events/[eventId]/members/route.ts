import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { sendUserInvitation } from "@/lib/mail";

export const GET = withEventAuth({ minRole: "ADMIN", allowArchived: true }, async (_req, { eventId }) => {
  const members = await prisma.eventMembership.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true, isStaff: true } },
    },
  });
  return NextResponse.json({ members });
});

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200).optional(),
  role: z.enum(["ADMIN", "OPERATOR", "PRINTER", "VIEWER"]),
});

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  let user = await prisma.user.findUnique({ where: { email } });
  const wasNew = !user;

  if (!user) {
    const inviteToken = randomBytes(32).toString("hex");
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name ?? email.split("@")[0],
        password: randomBytes(16).toString("hex"),
        inviteToken,
        inviteTokenExpiry,
      },
    });
    await logActivity({
      type: "USER_CREATED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: user.id,
      details: { email, via: "event-invite" },
      req,
    });
  }

  try {
    const membership = await prisma.eventMembership.create({
      data: { eventId, userId: user.id, role: parsed.data.role },
    });
    await logActivity({
      type: "MEMBERSHIP_ADDED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: user.id,
      details: { membershipId: membership.id, role: parsed.data.role, scope: "event" },
      req,
    });

    if (wasNew) {
      try {
        await sendUserInvitation(user.id, { eventId, orgId, role: parsed.data.role });
      } catch (e) {
        console.error("[mail] sendUserInvitation failed", e);
      }
    }

    return NextResponse.json({ membership: { id: membership.id, role: membership.role } }, { status: 201 });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "ALREADY_MEMBER", code: "ALREADY_MEMBER" }, { status: 409 });
    }
    throw err;
  }
});
