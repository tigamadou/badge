import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { computeSubscriptionDates, DEFAULT_PLAN_NAME } from "@/lib/subscription";
import { sendUserInvitation } from "@/lib/mail";

export const GET = withStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const archivedParam = searchParams.get("archived");
  const archived = archivedParam === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20),
  );

  const where: Prisma.OrganizationWhereInput = {
    archived,
    ...(q && {
      OR: [
        { name: { contains: q } },
        { slug: { contains: q } },
      ],
    }),
  };

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        archived: true,
        archivedAt: true,
        createdAt: true,
        _count: {
          select: {
            events: true,
            memberships: true,
          },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.organization.count({ where }),
  ]);

  return NextResponse.json({ organizations, total, page, pageSize });
});

// =====================================================
//  POST /api/platform/organizations - creation organisation + OWNER initial
// =====================================================

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function nextAvailableSlug(base: string): Promise<string> {
  let candidate = base;
  let n = 2;
  while (
    await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${n}`;
    n += 1;
    /* v8 ignore next -- garde-fou anti-boucle infinie : exigerait 1000 collisions de slug reelles */
    if (n > 999) throw new Error("Could not allocate slug");
  }
  return candidate;
}

const createOrgSchema = z.object({
  name: z.string().min(1).max(120),
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
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(120).optional(),
});

export const POST = withStaffAuth(
  async (req, { session }) => {
    const body = await req.json().catch(() => null);
    const parsed = createOrgSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const {
      name,
      slug,
      legalName,
      addressLine1,
      addressLine2,
      postalCode,
      city,
      country,
      taxId,
      website,
      logo,
      contactEmail,
      contactPhone,
      ownerEmail,
      ownerName,
    } = parsed.data;

    const baseSlug = slug ?? slugify(name);
    const finalSlug = await nextAvailableSlug(baseSlug);

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name,
          slug: finalSlug,
          legalName: legalName ?? null,
          addressLine1: addressLine1 ?? null,
          addressLine2: addressLine2 ?? null,
          postalCode: postalCode ?? null,
          city: city ?? null,
          country: country ?? null,
          taxId: taxId ?? null,
          website: website ?? null,
          logo: logo ?? null,
          contactEmail: contactEmail ?? null,
          contactPhone: contactPhone ?? null,
        },
      });

      const normalizedEmail = ownerEmail.toLowerCase().trim();
      let owner = await tx.user.findUnique({ where: { email: normalizedEmail } });
      let userCreated = false;
      if (!owner) {
        owner = await tx.user.create({
          data: {
            email: normalizedEmail,
            password: "",
            name: ownerName?.trim() || normalizedEmail,
            isStaff: false,
          },
        });
        userCreated = true;
      }

      await tx.orgMembership.create({
        data: { userId: owner.id, orgId: org.id, role: "OWNER" },
      });

      // Sans abonnement, l'organisation est bloquee (NO_SUBSCRIPTION) : elle demarre donc
      // sur le plan par defaut, que le staff pourra changer ensuite.
      const defaultPlan = await tx.plan.findFirst({
        where: { name: DEFAULT_PLAN_NAME, archived: false },
        select: { id: true, period: true },
      });
      const subscription = defaultPlan
        ? await tx.subscription.create({
            data: {
              orgId: org.id,
              planId: defaultPlan.id,
              status: "ACTIVE",
              ...computeSubscriptionDates(defaultPlan.period),
            },
          })
        : null;

      return { org, owner, userCreated, subscription };
    });

    await logActivity({
      type: "ORG_CREATED",
      userId: session.user.id,
      orgId: result.org.id,
      details: { name, slug: finalSlug },
      req,
    });
    if (result.subscription) {
      await logActivity({
        type: "SUBSCRIPTION_CREATED",
        userId: session.user.id,
        orgId: result.org.id,
        targetId: result.subscription.id,
        details: {
          planId: result.subscription.planId,
          status: result.subscription.status,
          auto: true,
        },
        req,
      });
    } else {
      console.warn(
        `[organizations] plan "${DEFAULT_PLAN_NAME}" introuvable ou archive : l'organisation ${result.org.id} est creee sans abonnement.`,
      );
    }
    if (result.userCreated) {
      await logActivity({
        type: "USER_CREATED",
        userId: session.user.id,
        orgId: result.org.id,
        targetId: result.owner.id,
        details: { email: result.owner.email, role: "OWNER" },
        req,
      });
    }
    await logActivity({
      type: "MEMBERSHIP_ADDED",
      userId: session.user.id,
      orgId: result.org.id,
      targetId: result.owner.id,
      details: { role: "OWNER" },
      req,
    });

    if (result.userCreated) {
      await sendUserInvitation(result.owner.id, {
        orgId: result.org.id,
        role: "OWNER",
      });
    }

    return NextResponse.json(
      {
        org: result.org,
        owner: { id: result.owner.id, email: result.owner.email },
      },
      { status: 201 },
    );
  },
  { minRole: "STAFF_ADMIN" },
);
