import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { generateId } from "@/lib/generate-id";
import { countCountableRegistrations } from "@/lib/event-quota";

export const GET = withEventAuth({ minRole: "OPERATOR", allowArchived: true }, async (req, { eventId }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const categoryId = url.searchParams.get("categoryId");
  const q = url.searchParams.get("q")?.trim();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "25")));

  const where: Prisma.RegistrationWhereInput = { eventId };
  if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    where.status = status as RegistrationStatus;
  }
  if (categoryId) where.categoryId = categoryId;
  if (q) {
    where.OR = [
      { email: { contains: q } },
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { idDocumentNumber: { contains: q } },
    ];
  }

  const [registrations, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        structure: true,
        status: true,
        badgePrinted: true,
        allAccessGranted: true,
        createdAt: true,
        category: { select: { id: true, name: true, color: true, number: true } },
      },
    }),
    prisma.registration.count({ where }),
  ]);

  return NextResponse.json({ registrations, total, page, limit });
});

const createSchema = z.object({
  categoryId: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  structure: z.string().min(1).max(200),
  idDocumentType: z.string().min(1).max(40),
  idDocumentNumber: z.string().min(1).max(80),
  photo: z.string().nullable().optional(),
  idDocument: z.string().nullable().optional(),
});

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }
  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category || category.eventId !== eventId) {
    return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { date: true } });
  if (!event) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const sequentialNumber = (await prisma.registration.count({
    where: { eventId, categoryId: parsed.data.categoryId },
  })) + 1;
  const id = generateId({
    categoryNumber: category.number,
    date: event.date.toISOString().slice(0, 10),
    sequentialNumber,
  });

  const registration = await prisma.registration.create({
    data: {
      id,
      eventId,
      categoryId: parsed.data.categoryId,
      email: parsed.data.email.toLowerCase().trim(),
      lastName: parsed.data.lastName,
      firstName: parsed.data.firstName,
      structure: parsed.data.structure,
      idDocumentType: parsed.data.idDocumentType,
      idDocumentNumber: parsed.data.idDocumentNumber,
      photo: parsed.data.photo ?? null,
      idDocument: parsed.data.idDocument ?? null,
      status: "APPROVED",
    },
  });

  const orgRow = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { quotaMaxRegistrations: true },
  });
  const after = await countCountableRegistrations(eventId);
  const quotaBypass = orgRow?.quotaMaxRegistrations != null && after > orgRow.quotaMaxRegistrations;

  await logActivity({
    type: "REGISTRATION_CREATED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: registration.id,
    details: { manual: true, status: "APPROVED", quotaBypass },
    req,
  });

  return NextResponse.json({ registration }, { status: 201 });
});
