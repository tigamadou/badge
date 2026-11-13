import { NextResponse } from "next/server";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { notifyEventRegistrationToggled } from "@/lib/notifications/triggers";
import {
  MAX_SECURITY_INSTRUCTIONS,
  MAX_SECURITY_INSTRUCTION_CHARS,
  cleanSecurityInstructions,
  readSecurityInstructions,
} from "@/lib/security-instructions";
import { readTemplateOptions, templateOptionsSchema } from "@/lib/badge-templates/template-options";
import {
  getEventImageRequirements,
  rejectionResponse,
  validateStoredImage,
  keyHasPrefix,
  type ImageSlot,
} from "@/lib/event-image-compliance";

// Colonnes associees a chaque image d'evenement.
const IMAGE_COLUMNS = {
  logo: { key: "logo", original: "logoOriginal", width: "logoWidth", height: "logoHeight" },
  banner: { key: "banner", original: "bannerOriginal", width: "bannerWidth", height: "bannerHeight" },
} as const;
const IMAGE_SLOTS: ImageSlot[] = ["logo", "banner"];

export const GET = withEventAuth({ permission: "event.read.detailed", allowArchived: true }, async (_req, { eventId }) => {
  // withEventAuth a deja garanti l'existence de l'event -> findUniqueOrThrow.
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      slug: true,
      location: true,
      date: true,
      endDate: true,
      description: true,
      logo: true,
      banner: true,
      templateOptions: true,
      securityInstructions: true,
      registrationOpen: true,
      archived: true,
      createdAt: true,
      orgId: true,
      organization: { select: { id: true, name: true, slug: true } },
      _count: { select: { registrations: true, categories: true, memberships: true } },
    },
  });
  return NextResponse.json({
    event: {
      ...event,
      securityInstructions: readSecurityInstructions(event.securityInstructions),
      templateOptions: readTemplateOptions(event.templateOptions),
    },
  });
});

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  location: z.string().max(200).optional(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  endDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .nullable()
    .optional(),
  description: z.string().max(5000).nullable().optional(),
  logo: z.string().nullable().optional(),
  banner: z.string().nullable().optional(),
  logoOriginal: z.string().max(500).nullable().optional(),
  bannerOriginal: z.string().max(500).nullable().optional(),
  templateOptions: templateOptionsSchema.optional(),
  registrationOpen: z.boolean().optional(),
  securityInstructions: z
    .array(z.string().max(MAX_SECURITY_INSTRUCTION_CHARS))
    .max(MAX_SECURITY_INSTRUCTIONS)
    .optional(),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
});

export const PATCH = withEventAuth({ permission: "event.update", allowArchived: false }, async (req, { orgId, eventId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const before = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      registrationOpen: true,
      date: true,
      securityInstructions: true,
      templateOptions: true,
      logo: true,
      banner: true,
      logoOriginal: true,
      bannerOriginal: true,
      badgeTemplateId: true,
    },
  });

  // v4 (plan 07) : la date de fin se compare a la date effective apres patch.
  if (parsed.data.endDate) {
    const effectiveDate = parsed.data.date ? new Date(parsed.data.date) : before?.date;
    if (effectiveDate && new Date(parsed.data.endDate) < effectiveDate) {
      return NextResponse.json(
        { error: "VALIDATION", issues: [{ path: ["endDate"], message: "endDate < date" }] },
        { status: 400 },
      );
    }
  }

  const data: Prisma.EventUpdateInput = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.location !== undefined) data.location = parsed.data.location;
  if (parsed.data.date !== undefined) data.date = new Date(parsed.data.date);
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.endDate !== undefined) {
    data.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
  }
  // Images : relecture du fichier stocke seulement quand la cle CHANGE (le formulaire
  // renvoie toute la fiche : pas de blocage retroactif d'une image heritee).
  const changedImages: { slot: ImageSlot; removed: boolean }[] = [];
  // Cles fournies par le client : uniquement celles de l'organisation ou de l'evenement.
  const allowedPrefixes = [`orgs/${orgId}/`, `events/${eventId}/`];
  // Un original inchange (renvoye tel quel par le formulaire, eventuellement ancien) n'est pas revalide.
  const originals = [
    [parsed.data.logoOriginal, before.logoOriginal],
    [parsed.data.bannerOriginal, before.bannerOriginal],
  ] as const;
  for (const [original, current] of originals) {
    if (original && original !== current && !keyHasPrefix(original, allowedPrefixes)) {
      return NextResponse.json({ error: "Image introuvable.", code: "INVALID_IMAGE" }, { status: 400 });
    }
  }
  if (parsed.data.logoOriginal !== undefined) data.logoOriginal = parsed.data.logoOriginal;
  if (parsed.data.bannerOriginal !== undefined) data.bannerOriginal = parsed.data.bannerOriginal;
  let requirements: Awaited<ReturnType<typeof getEventImageRequirements>> | null = null;
  for (const slot of IMAGE_SLOTS) {
    const cols = IMAGE_COLUMNS[slot];
    const key = parsed.data[cols.key];
    if (key === undefined) continue;
    const changed = key !== before[cols.key];
    if (key === null) {
      Object.assign(data, { [cols.key]: null, [cols.original]: null, [cols.width]: null, [cols.height]: null });
    } else {
      if (changed) {
        requirements ??= await getEventImageRequirements({ badgeTemplateId: before.badgeTemplateId, orgId });
        const verdict = await validateStoredImage(key, requirements[slot] ?? null, { engineFormatsOnly: true, allowedPrefixes });
        if (!verdict.ok) return rejectionResponse(verdict, { slot });
        Object.assign(data, { [cols.width]: verdict.width, [cols.height]: verdict.height });
      }
      data[cols.key] = key;
    }
    if (changed) changedImages.push({ slot, removed: key === null });
  }
  if (parsed.data.templateOptions !== undefined) {
    // Les listes sont nettoyees comme les consignes (espaces, lignes vides).
    const cleanedOptions = Object.fromEntries(
      Object.entries(parsed.data.templateOptions).map(([key, value]) => [
        key,
        Array.isArray(value) ? cleanSecurityInstructions(value) : value,
      ]),
    );
    // Ecrit uniquement si l'objet differe de celui stocke (journal limite aux vrais changements) ; comparaison insensible a l'ordre des cles (MySQL reordonne le JSON).
    if (!isDeepStrictEqual(readTemplateOptions(before?.templateOptions), cleanedOptions)) {
      data.templateOptions = cleanedOptions;
    }
  }
  if (parsed.data.registrationOpen !== undefined) data.registrationOpen = parsed.data.registrationOpen;
  if (parsed.data.securityInstructions !== undefined) {
    const cleaned = cleanSecurityInstructions(parsed.data.securityInstructions);
    // Ecrit uniquement si la liste nettoyee differe de celle stockee.
    if (JSON.stringify(readSecurityInstructions(before?.securityInstructions)) !== JSON.stringify(cleaned)) {
      data.securityInstructions = cleaned;
    }
  }
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

    for (const image of changedImages) {
      await logActivity({
        type: "EVENT_IMAGE_UPDATED",
        userId: session.user.id,
        orgId,
        eventId,
        details: image,
        req,
      });
    }

    if (parsed.data.registrationOpen !== undefined && before?.registrationOpen !== parsed.data.registrationOpen) {
      await logActivity({
        type: parsed.data.registrationOpen ? "EVENT_REGISTRATION_OPENED" : "EVENT_REGISTRATION_CLOSED",
        userId: session.user.id,
        orgId,
        eventId,
        req,
      });
      await notifyEventRegistrationToggled(eventId, parsed.data.registrationOpen, session.user.id);
    }

    return NextResponse.json({
      event: {
        ...event,
        securityInstructions: readSecurityInstructions(event.securityInstructions),
        templateOptions: readTemplateOptions(event.templateOptions),
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
    }
    throw err;
  }
});
