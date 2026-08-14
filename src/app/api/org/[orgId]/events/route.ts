import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";
import { logActivity } from "@/lib/activity-log";
import { assertCanCreateEvent, SubscriptionError } from "@/lib/subscription";
import { uniqueEventSlug } from "@/lib/slugify-event";

export const GET = withOrgAuth("AUDITOR", async (req, { orgId }) => {
  const url = new URL(req.url);
  const archived = url.searchParams.get("archived");
  const registrationOpen = url.searchParams.get("registrationOpen");

  const where: Prisma.EventWhereInput = { orgId };
  if (archived !== null) where.archived = archived === "true";
  if (registrationOpen !== null) where.registrationOpen = registrationOpen === "true";

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      date: true,
      location: true,
      registrationOpen: true,
      archived: true,
      createdAt: true,
      _count: { select: { registrations: true } },
    },
  });
  return NextResponse.json({ events });
});

const createSchema = z.object({
  title: z.string().min(1).max(180),
  location: z.string().max(180).default(""),
  date: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: "Invalid date" }),
  endDate: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Invalid endDate" })
    .nullable()
    .optional(),
  description: z.string().max(5000).nullable().optional(),
  logo: z.string().nullable().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .min(2)
    .max(80)
    .optional(),
  templateIds: z.array(z.string()).optional(),
  manualCategories: z
    .array(
      z.object({
        name: z.string().min(1),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        number: z.number().int().min(0),
        neutralBadge: z.boolean().optional(),
        anonymous: z.boolean().optional(),
      }),
    )
    .optional(),
});

type CatInput = {
  name: string;
  color: string;
  number: number;
  neutralBadge?: boolean;
  anonymous?: boolean;
};

// ADR 2026-06-01 (v2-14 Task 2) : MANAGER autorise a creer un event (spec espace-organisation).
export const POST = withOrgAuth("MANAGER", async (req, { orgId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (data.endDate && new Date(data.endDate) < new Date(data.date)) {
    return NextResponse.json(
      { error: "VALIDATION", issues: [{ path: ["endDate"], message: "endDate < date" }] },
      { status: 400 },
    );
  }

  try {
    await assertCanCreateEvent(orgId);
  } catch (e) {
    if (e instanceof SubscriptionError) {
      if (session.user.isStaff) {
        await logActivity({
          type: "QUOTA_BYPASS",
          userId: session.user.id,
          orgId,
          details: { action: "EVENT_CREATE", code: e.code },
          req,
        });
      } else {
        return NextResponse.json({ error: e.message, code: e.code }, { status: e.httpStatus });
      }
    } else {
      throw e;
    }
  }

  const slug = data.slug ?? (await uniqueEventSlug(data.title));

  let categoryInputs: CatInput[] = [];
  if (data.templateIds && data.templateIds.length > 0) {
    const templates = await prisma.categoryTemplate.findMany({
      where: { id: { in: data.templateIds }, orgId },
    });
    categoryInputs = templates.map((t) => ({
      name: t.name,
      color: t.color,
      number: t.number,
      neutralBadge: t.neutralBadge,
      anonymous: t.anonymous,
    }));
  }
  if (data.manualCategories && data.manualCategories.length > 0) {
    categoryInputs.push(...data.manualCategories);
  }

  // Renumerotation : garantit l'unicite des numeros au sein de l'event (1..N).
  const seenNumbers = new Set<number>();
  let nextFreeNumber = 1;
  categoryInputs = categoryInputs.map((c) => {
    if (seenNumbers.has(c.number)) {
      while (seenNumbers.has(nextFreeNumber)) nextFreeNumber++;
      c = { ...c, number: nextFreeNumber };
    }
    seenNumbers.add(c.number);
    return c;
  });

  try {
    const event = await prisma.event.create({
      data: {
        orgId,
        title: data.title,
        slug,
        location: data.location,
        date: new Date(data.date),
        endDate: data.endDate ? new Date(data.endDate) : null,
        description: data.description ?? null,
        logo: data.logo ?? null,
        registrationOpen: false,
        categories: {
          create: categoryInputs.map((c) => ({
            name: c.name,
            color: c.color,
            number: c.number,
            neutralBadge: c.neutralBadge ?? false,
            anonymous: c.anonymous ?? false,
          })),
        },
      },
    });

    await logActivity({
      type: "EVENT_CREATED",
      userId: session.user.id,
      orgId,
      eventId: event.id,
      details: {
        title: data.title,
        slug,
        categoriesCount: categoryInputs.length,
        templatesUsed: data.templateIds ?? [],
      },
      req,
    });

    return NextResponse.json({ event: { id: event.id, slug: event.slug } }, { status: 201 });
  } catch (err) {
    const e = err as { code?: string; meta?: { target?: unknown } };
    // P2002 (unique) : selon le connecteur, `meta.target` est un tableau de champs
    // (Postgres : ["slug"]) OU une chaine = nom d'index (MySQL : "Event_slug_key").
    const target = e.meta?.target;
    const isSlugConflict = Array.isArray(target)
      ? target.includes("slug")
      : typeof target === "string" && target.toLowerCase().includes("slug");
    if (e.code === "P2002" && isSlugConflict) {
      return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
    }
    throw err;
  }
});
