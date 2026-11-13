import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { systemRoleId } from "@/lib/permissions/db";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { notifyMembershipRoleChanged } from "@/lib/notifications/triggers";

const patchSchema = z.object({ role: z.enum(["ADMIN", "OPERATOR", "PRINTER", "VIEWER"]) });

export const PATCH = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { membershipId } = (await extra.params) as { orgId: string; eventId: string; membershipId: string };
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.eventMembership.findUnique({ where: { id: membershipId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const updated = await prisma.eventMembership.update({
    where: { id: membershipId },
    // @deprecated compat chantier roles-permissions (retiré à la fusion) : roleId double l'enum.
    data: { role: parsed.data.role, roleId: await systemRoleId(prisma, parsed.data.role) },
  });
  await logActivity({
    type: "MEMBERSHIP_ROLE_CHANGED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: updated.userId,
    details: { from: existing.role, to: parsed.data.role, scope: "event" },
    req,
  });
  await notifyMembershipRoleChanged({
    userId: updated.userId,
    eventId,
    from: existing.role ?? "VIEWER",
    to: parsed.data.role,
    actorId: session.user.id,
  });
  return NextResponse.json({ membership: updated });
});

export const DELETE = withEventAuth({ minRole: "ADMIN" }, async (req, { orgId, eventId, session }, extra) => {
  const { membershipId } = (await extra.params) as { orgId: string; eventId: string; membershipId: string };
  const existing = await prisma.eventMembership.findUnique({ where: { id: membershipId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.eventMembership.delete({ where: { id: membershipId } });
  await logActivity({
    type: "MEMBERSHIP_REMOVED",
    userId: session.user.id,
    orgId,
    eventId,
    targetId: existing.userId,
    details: { role: existing.role, scope: "event" },
    req,
  });
  return new NextResponse(null, { status: 204 });
});
