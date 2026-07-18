import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Schema strict : seuls les champs admin acceptes. Tout autre champ
// (smtp*, recaptcha*, archived, archivedAt, isStaff, id, createdAt...) est
// rejete via .strict() pour eviter qu'un client legacy n'ecrive des secrets.
const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    slug: z.string().min(2).max(60).regex(SLUG_RE).optional(),
    legalName: z.string().min(1).max(180).nullable().optional(),
    addressLine1: z.string().min(1).max(180).nullable().optional(),
    addressLine2: z.string().min(1).max(180).nullable().optional(),
    postalCode: z.string().min(1).max(20).nullable().optional(),
    city: z.string().min(1).max(120).nullable().optional(),
    country: z.string().min(2).max(60).nullable().optional(),
    taxId: z.string().min(1).max(60).nullable().optional(),
    website: z.string().url().max(200).nullable().optional(),
    logo: z.string().max(500).nullable().optional(),
    contactEmail: z.string().email().nullable().optional(),
    contactPhone: z.string().min(3).max(40).nullable().optional(),
  })
  .strict();

export const GET = withStaffAuth<{ orgId: string }>(async (_req, _ctx, extra) => {
  const { orgId } = await extra.params;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      legalName: true,
      slug: true,
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      city: true,
      country: true,
      taxId: true,
      website: true,
      logo: true,
      contactEmail: true,
      contactPhone: true,
      archived: true,
      archivedAt: true,
      createdAt: true,
      _count: { select: { events: true, memberships: true } },
      memberships: {
        where: { role: "OWNER" },
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!org) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ org });
});

export const PATCH = withStaffAuth<{ orgId: string }>(
  async (req, { session }, extra) => {
    const { orgId } = await extra.params;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "NOTHING_TO_UPDATE" },
        { status: 400 },
      );
    }

    try {
      const org = await prisma.organization.update({
        where: { id: orgId },
        data,
      });
      await logActivity({
        type: "ORG_UPDATED",
        userId: session.user.id,
        orgId,
        details: data as Prisma.InputJsonValue,
        req,
      });
      return NextResponse.json({ org });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "P2025") {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }
      if (code === "P2002") {
        return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
      }
      throw err;
    }
  },
  { minRole: "STAFF_ADMIN" },
);

export const DELETE = withStaffAuth<{ orgId: string }>(
  async (req, { session }, extra) => {
    const { orgId } = await extra.params;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, slug: true, name: true },
    });
    if (!org) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    // Confirmation : soit header x-confirm = "delete-<slug>",
    // soit body { confirmSlug: "<slug>" }.
    const headerConfirm = req.headers.get("x-confirm");
    let bodyConfirmSlug: string | undefined;
    try {
      const body = (await req.clone().json()) as { confirmSlug?: string } | null;
      bodyConfirmSlug = body?.confirmSlug;
    } catch {
      bodyConfirmSlug = undefined;
    }

    const ok =
      headerConfirm === `delete-${org.slug}` || bodyConfirmSlug === org.slug;
    if (!ok) {
      return NextResponse.json(
        { error: "CONFIRMATION_REQUIRED" },
        { status: 400 },
      );
    }

    // ADR 2026-06-01 (v2-14 Task 6) : tracer ORG_DELETED AVANT la cascade.
    // On loggue avec orgId=null pour que l'entree survive a la suppression de
    // l'org elle-meme (sinon FK SetNull casserait le lien). targetId conserve
    // l'orgId d'origine pour audit.
    await logActivity({
      type: "ORG_DELETED",
      userId: session.user.id,
      targetId: orgId,
      details: { name: org.name, slug: org.slug },
      req,
    });

    // Cascade delete via onDelete:Cascade sur tous les FK enfants
    // (OrgMembership, Event -> EventMembership -> Category -> Registration...).
    await prisma.organization.delete({ where: { id: orgId } });

    return new NextResponse(null, { status: 204 });
  },
  { minRole: "SUPER_ADMIN" },
);
