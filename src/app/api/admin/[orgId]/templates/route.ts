import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";
import { logActivity } from "@/lib/activity-log";

const templateSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  number: z.number().int().min(0).max(999),
  neutralBadge: z.boolean().optional(),
  anonymous: z.boolean().optional(),
});

export const GET = withOrgAuth("AUDITOR", async (_req, { orgId }) => {
  const templates = await prisma.categoryTemplate.findMany({
    where: { orgId },
    orderBy: [{ number: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ templates });
});

export const POST = withOrgAuth("OWNER", async (req, { orgId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = templateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const template = await prisma.categoryTemplate.create({
    data: { orgId, ...parsed.data },
  });

  await logActivity({
    type: "CATEGORY_TEMPLATE_CREATED",
    userId: session.user.id,
    orgId,
    targetId: template.id,
    details: parsed.data,
    req,
  });

  return NextResponse.json({ template }, { status: 201 });
});
