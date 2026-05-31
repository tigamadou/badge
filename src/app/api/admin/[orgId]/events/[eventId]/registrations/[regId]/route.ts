import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

type Params = { orgId: string; eventId: string; regId: string };

export const GET = withEventAuth({ minRole: "OPERATOR", allowArchived: true }, async (_req, { eventId }, extra) => {
  const { regId } = (await extra.params) as Params;
  const registration = await prisma.registration.findUnique({
    where: { id: regId },
    include: {
      category: true,
      snapshots: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!registration || registration.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const { editToken: _editToken, ...safe } = registration;
  return NextResponse.json({ registration: safe });
});

const patchSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  structure: z.string().min(1).max(200).optional(),
  categoryId: z.string().optional(),
  idDocumentType: z.string().min(1).max(40).optional(),
  idDocumentNumber: z.string().min(1).max(80).optional(),
  photo: z.string().nullable().optional(),
  idDocument: z.string().nullable().optional(),
  allAccessGranted: z.boolean().optional(),
});

export const PATCH = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = (await extra.params) as Params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (parsed.data.categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
    if (!cat || cat.eventId !== eventId) {
      return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
    }
  }

  await prisma.submissionSnapshot.create({
    data: {
      registrationId: existing.id,
      lastName: existing.lastName,
      firstName: existing.firstName,
      email: existing.email,
      structure: existing.structure,
      categoryId: existing.categoryId,
      idDocumentType: existing.idDocumentType,
      idDocumentNumber: existing.idDocumentNumber,
      photo: existing.photo,
      idDocument: existing.idDocument,
    },
  });

  const updated = await prisma.registration.update({
    where: { id: regId },
    data: parsed.data,
  });

  await logActivity({
    type: "REGISTRATION_UPDATED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { changedFields: Object.keys(parsed.data) },
    req,
  });

  const { editToken: _editToken, ...safe } = updated;
  return NextResponse.json({ registration: safe });
});

export const DELETE = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { regId } = (await extra.params) as Params;
  const existing = await prisma.registration.findUnique({ where: { id: regId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.registration.delete({ where: { id: regId } });
  await logActivity({
    type: "REGISTRATION_DELETED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: regId,
    details: { email: existing.email },
    req,
  });
  return new NextResponse(null, { status: 204 });
});
