import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgRole, AuthError } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity-log";

type Params = { params: Promise<{ orgId: string; id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  number: z.number().int().min(0).max(999).optional(),
  neutralBadge: z.boolean().optional(),
  anonymous: z.boolean().optional(),
});

async function authorize(orgId: string): Promise<{ userId: string } | Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await requireOrgRole(session.user.id, orgId, "OWNER");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    }
    throw err;
  }
  return { userId: session.user.id };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { orgId, id } = await params;
  const auth = await authorize(orgId);
  if (auth instanceof Response) return auth;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const existing = await prisma.categoryTemplate.findUnique({ where: { id } });
  if (!existing || existing.orgId !== orgId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const updated = await prisma.categoryTemplate.update({ where: { id }, data: parsed.data });
  await logActivity({
    type: "CATEGORY_TEMPLATE_UPDATED",
    userId: auth.userId,
    orgId,
    targetId: id,
    details: parsed.data,
    req,
  });
  return NextResponse.json({ template: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { orgId, id } = await params;
  const auth = await authorize(orgId);
  if (auth instanceof Response) return auth;

  const existing = await prisma.categoryTemplate.findUnique({ where: { id } });
  if (!existing || existing.orgId !== orgId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.categoryTemplate.delete({ where: { id } });
  await logActivity({
    type: "CATEGORY_TEMPLATE_DELETED",
    userId: auth.userId,
    orgId,
    targetId: id,
    details: { name: existing.name },
    req,
  });
  return new NextResponse(null, { status: 204 });
}
