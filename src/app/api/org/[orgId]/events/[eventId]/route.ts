import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

export const GET = withEventAuth({ minRole: "OPERATOR", allowArchived: true }, async (_req, { eventId }) => {
  // withEventAuth a deja garanti l'existence de l'event -> findUniqueOrThrow.
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      slug: true,
      location: true,
      date: true,
      logo: true,
      registrationOpen: true,
      archived: true,
      createdAt: true,
      orgId: true,
      organization: { select: { id: true, name: true, slug: true } },
      _count: { select: { registrations: true, categories: true, memberships: true } },
    },
  });
  return NextResponse.json({ event });
});

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  location: z.string().max(200).optional(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  logo: z.string().nullable().optional(),
  registrationOpen: z.boolean().optional(),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
});

export const PATCH = withEventAuth({ minRole: "ADMIN", allowArchived: false }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const before = await prisma.event.findUnique({
    where: { id: eventId },
    select: { registrationOpen: true },
  });

  const data: Prisma.EventUpdateInput = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.location !== undefined) data.location = parsed.data.location;
  if (parsed.data.date !== undefined) data.date = new Date(parsed.data.date);
  if (parsed.data.logo !== undefined) data.logo = parsed.data.logo;
  if (parsed.data.registrationOpen !== undefined) data.registrationOpen = parsed.data.registrationOpen;
  if (parsed.data.slug !== undefined && session.user.isStaff) data.slug = parsed.data.slug;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
  }

  try {
    const event = await prisma.event.update({ where: { id: eventId }, data });

    await logActivity({
      type: "EVENT_UPDATED",
      userId: session.user.id,
      orgId,
      eventId,
      details: { changedFields: Object.keys(data) },
      req,
    });

    if (parsed.data.registrationOpen !== undefined && before?.registrationOpen !== parsed.data.registrationOpen) {
      await logActivity({
        type: parsed.data.registrationOpen ? "EVENT_REGISTRATION_OPENED" : "EVENT_REGISTRATION_CLOSED",
        userId: session.user.id,
        orgId,
        eventId,
        req,
      });
    }

    return NextResponse.json({ event });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
    }
    throw err;
  }
});
