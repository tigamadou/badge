import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgRole, AuthError } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity-log";

type Params = { params: Promise<{ orgId: string; eventId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId, eventId } = await params;
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

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.orgId !== orgId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { archived: false, archivedAt: null },
  });

  await logActivity({
    type: "EVENT_RESTORED",
    userId: session.user.id,
    orgId,
    eventId,
    details: { title: event.title },
    req,
  });

  return NextResponse.json({ ok: true });
}
