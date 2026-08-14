import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

export const GET = withEventAuth(
  { minRole: "ADMIN", allowArchived: true },
  async (_req, { eventId }) => {
    const blocked = await prisma.blockedEmail.findMany({
      where: { eventId } satisfies Prisma.BlockedEmailWhereInput,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ blocked });
  },
);

const schema = z.object({
  email: z.string().email(),
  reason: z.string().max(500).optional(),
});

export const POST = withEventAuth(
  { minRole: "ADMIN" },
  async (req, { orgId, eventId, session }) => {
    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const email = parsed.data.email.toLowerCase().trim();
    try {
      const blocked = await prisma.blockedEmail.create({
        data: { eventId, email, reason: parsed.data.reason ?? null },
      });
      await logActivity({
        type: "REGISTRATION_UPDATED",
        userId: session.user.id,
        orgId,
        eventId,
        details: { action: "blocked-email-added", email },
        req,
      });
      return NextResponse.json({ blocked }, { status: 201 });
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: "ALREADY_BLOCKED", code: "ALREADY_BLOCKED" },
          { status: 409 },
        );
      }
      throw err;
    }
  },
);
