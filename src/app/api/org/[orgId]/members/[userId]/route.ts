import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgRole, assertNotLastOwner, AuthError } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity-log";
import { notifyMembershipRoleChanged } from "@/lib/notifications/triggers";

type Params = { params: Promise<{ orgId: string; userId: string }> };

const patchSchema = z.object({ role: z.enum(["OWNER", "MANAGER", "AUDITOR"]) }).strict();

export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, userId } = await params;
  try {
    await requireOrgRole(session.user.id, orgId, "OWNER");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    }
    throw err;
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const { role: nextRole } = parsed.data;
  if (existing.role === nextRole) {
    return NextResponse.json({ membership: existing });
  }

  // Garde-fou : si on retrograde un OWNER vers MANAGER/AUDITOR, il doit rester
  // au moins un autre OWNER actif dans l'org.
  if (existing.role === "OWNER" && nextRole !== "OWNER") {
    try {
      await assertNotLastOwner(orgId, userId);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json(
          { error: "Dernier OWNER : impossible de retrograder", code: err.code },
          { status: err.httpStatus },
        );
      }
      throw err;
    }
  }

  const updated = await prisma.orgMembership.update({
    where: { id: existing.id },
    data: { role: nextRole },
  });

  await logActivity({
    type: "MEMBERSHIP_ROLE_CHANGED",
    userId: session.user.id,
    orgId,
    targetId: userId,
    details: { from: existing.role, to: nextRole, scope: "org" },
    req,
  });

  await notifyMembershipRoleChanged({
    userId,
    orgId,
    from: existing.role ?? "AUDITOR",
    to: nextRole,
    actorId: session.user.id,
  });

  return NextResponse.json({ membership: updated });
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, userId } = await params;
  try {
    await requireOrgRole(session.user.id, orgId, "OWNER");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    }
    throw err;
  }

  // ADR 2026-06-01 (v2-14 Task 2) : filtrer user.archived=false pour aligner sur
  // assertNotLastOwner (sinon un OWNER archive serait compte et masquerait le
  // garde-fou last-owner).
  const ownerCount = await prisma.orgMembership.count({
    where: { orgId, role: "OWNER", user: { archived: false } },
  });
  const target = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (target.role === "OWNER" && ownerCount <= 1) {
    return NextResponse.json(
      { error: "Last OWNER cannot be removed", code: "LAST_OWNER" },
      { status: 409 },
    );
  }

  await prisma.orgMembership.delete({ where: { id: target.id } });
  await logActivity({
    type: "MEMBERSHIP_REMOVED",
    userId: session.user.id,
    orgId,
    targetId: userId,
    details: { role: target.role },
    req,
  });

  return new NextResponse(null, { status: 204 });
}
