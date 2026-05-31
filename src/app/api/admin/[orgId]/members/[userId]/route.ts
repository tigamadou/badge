import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgRole, AuthError } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity-log";

type Params = { params: Promise<{ orgId: string; userId: string }> };

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

  const ownerCount = await prisma.orgMembership.count({ where: { orgId, role: "OWNER" } });
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
