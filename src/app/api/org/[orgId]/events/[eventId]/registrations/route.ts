import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { generateId } from "@/lib/generate-id";
import { countCountableRegistrations, resolveOrgLimits } from "@/lib/subscription";
import { buildRegistrationSnapshot } from "@/lib/participant-profile";
import { canRegisterToEvent } from "@/lib/profile-review";
import { toRegistrationListDTO } from "@/lib/registration-dto";
import { parseListPage } from "@/lib/list-query";

export const GET = withEventAuth({ minRole: "OPERATOR", allowArchived: true }, async (req, { eventId }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const categoryId = url.searchParams.get("categoryId");
  const q = url.searchParams.get("q")?.trim();
  const { page, pageSize, skip, take } = parseListPage(url.searchParams);

  const where: Prisma.RegistrationWhereInput = { eventId };
  if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    where.status = status as RegistrationStatus;
  }
  if (categoryId) where.categoryId = categoryId;
  if (q) {
    where.OR = [
      { snapshotEmail: { contains: q } },
      { snapshotFirstName: { contains: q } },
      { snapshotLastName: { contains: q } },
      { snapshotIdDocumentNumber: { contains: q } },
    ];
  }

  const [registrations, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        snapshotFirstName: true,
        snapshotLastName: true,
        snapshotEmail: true,
        snapshotStructure: true,
        status: true,
        badgePrinted: true,
        allAccessGranted: true,
        createdAt: true,
        category: { select: { id: true, name: true, color: true, number: true } },
      },
    }),
    prisma.registration.count({ where }),
  ]);

  return NextResponse.json({
    registrations: registrations.map(toRegistrationListDTO),
    total,
    page,
    pageSize,
  });
});

// v2-11 : l'admin cree une registration pour un User existant (le User porte
// le profil persistant). L'admin choisit le user par id ou email. Si le user
// n'existe pas ou si son profil est incomplet, on refuse 400.
const createSchema = z.object({
  categoryId: z.string().min(1),
  userId: z.string().optional(),
  email: z.string().email().optional(),
}).refine((d) => Boolean(d.userId) || Boolean(d.email), {
  message: "userId or email required",
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

  // withEventAuth a deja garanti l'existence de l'event.
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { date: true } });

  const user = parsed.data.userId
    ? await prisma.user.findUnique({
        where: { id: parsed.data.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          structure: true,
          photo: true,
          idDocumentType: true,
          idDocumentNumber: true,
          idDocument: true,
          profileStatus: true,
        },
      })
    : await prisma.user.findUnique({
        where: { email: parsed.data.email!.toLowerCase().trim() },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          structure: true,
          photo: true,
          idDocumentType: true,
          idDocumentNumber: true,
          idDocument: true,
          profileStatus: true,
        },
      });

  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  let snapshot;
  try {
    snapshot = buildRegistrationSnapshot(user);
  } catch {
    return NextResponse.json({ error: "PROFILE_INCOMPLETE" }, { status: 400 });
  }

  // v4 (plan 09) : le participant cible doit avoir depose ses pieces.
  if (!canRegisterToEvent(user.profileStatus)) {
    return NextResponse.json({ error: "PROFILE_NOT_SUBMITTED" }, { status: 403 });
  }

  const existingReg = await prisma.registration.findUnique({
    where: { userId_eventId: { userId: user.id, eventId } },
    select: { id: true },
  });
  if (existingReg) {
    return NextResponse.json({ error: "ALREADY_REGISTERED", registrationId: existingReg.id }, { status: 409 });
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
      userId: user.id,
      ...snapshot,
      status: "APPROVED",
    },
  });

  const { maxParticipantsPerEvent } = await resolveOrgLimits(orgId);
  const after = await countCountableRegistrations(eventId);
  const quotaBypass = maxParticipantsPerEvent != null && after > maxParticipantsPerEvent;

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
