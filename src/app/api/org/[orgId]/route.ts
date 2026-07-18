import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";
import { logActivity } from "@/lib/activity-log";

export const GET = withOrgAuth("AUDITOR", async (_req, { orgId }) => {
  // ADR 2026-06-01 (v2-14 Task 10) : select enrichi avec champs administratifs
  // (legalName, adresse, taxId, website, logo, contacts). Auparavant tronque
  // aux compteurs/quotas -- la page settings org n'affichait pas ces infos.
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      legalName: true,
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
      _count: {
        select: {
          events: true,
          memberships: true,
        },
      },
    },
  });
  if (!org) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ org });
});

// Note (2026-05-31) : OrgSettings supprime, infos administratives fusionnees dans
// Organization. Le schema .strict() refuse tout champ SMTP/reCAPTCHA legacy : ces
// secrets vivent uniquement dans PlatformSettings.
const patchSchema = z
  .object({
    // OWNER editable
    name: z.string().min(1).max(120).optional(),
    legalName: z.string().max(200).nullable().optional(),
    addressLine1: z.string().max(200).nullable().optional(),
    addressLine2: z.string().max(200).nullable().optional(),
    postalCode: z.string().max(20).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    country: z.string().max(100).nullable().optional(),
    taxId: z.string().max(50).nullable().optional(),
    website: z.string().url().max(255).nullable().optional(),
    logo: z.string().max(500).nullable().optional(),
    contactEmail: z.string().email().nullable().optional(),
    contactPhone: z.string().max(50).nullable().optional(),
    // Staff-only
    slug: z
      .string()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
  })
  .strict();

const OWNER_FIELDS = [
  "name",
  "legalName",
  "addressLine1",
  "addressLine2",
  "postalCode",
  "city",
  "country",
  "taxId",
  "website",
  "logo",
  "contactEmail",
  "contactPhone",
] as const;

const STAFF_FIELDS = ["slug"] as const;

export const PATCH = withOrgAuth("OWNER", async (req, { orgId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const isStaff = session.user.isStaff;
  const data: Record<string, unknown> = {};
  for (const k of OWNER_FIELDS) {
    if (k in parsed.data) data[k] = (parsed.data as Record<string, unknown>)[k];
  }
  if (isStaff) {
    for (const k of STAFF_FIELDS) {
      if (k in parsed.data) data[k] = (parsed.data as Record<string, unknown>)[k];
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
  }

  try {
    const org = await prisma.organization.update({ where: { id: orgId }, data });
    await logActivity({
      type: "ORG_UPDATED",
      userId: session.user.id,
      orgId,
      details: { changedFields: Object.keys(data) },
      req,
    });
    return NextResponse.json({ org });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
    }
    throw err;
  }
});
