import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { eventTargetOf } from "@/lib/permissions";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import {
  RoleError,
  actorContext,
  assertCanAssignRole,
  eventRoleColumns,
  notifyRoleChanged,
  resolveAssignableRole,
  roleLogKey,
  roleView,
  withRoleErrors,
} from "@/lib/role-management";

const patchSchema = z.object({ roleId: z.string().min(1) }).strict();

const membershipIdOf = async (extra: { params: Promise<unknown> }) => ((await extra.params) as { membershipId: string }).membershipId;

export const PATCH = withEventAuth({ permission: "event.members.manage" }, (req, { orgId, eventId, session }, extra) =>
  withRoleErrors(async () => {
    const membershipId = await membershipIdOf(extra);
    const json = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }

    const existing = await prisma.eventMembership.findUnique({
      where: { id: membershipId },
      include: { roleRef: { select: { id: true, name: true, systemKey: true } } },
    });
    if (!existing || existing.eventId !== eventId) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    // Personne ne modifie son propre rôle.
    if (existing.userId === session.user.id) throw new RoleError("SELF_MODIFICATION");

    const next = await resolveAssignableRole(parsed.data.roleId, { scope: "EVENT", orgId });
    const actor = await actorContext(session.user.id);
    assertCanAssignRole(actor, next, eventTargetOf({ eventId, orgId }));

    const updated = await prisma.eventMembership.update({
      where: { id: membershipId },
      // @deprecated compat chantier roles-permissions (retiré à la fusion) : roleId double l'enum.
      data: eventRoleColumns(next),
    });
    const from = roleView(existing.roleRef, existing.role);
    await logActivity({
      type: "MEMBERSHIP_ROLE_CHANGED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: updated.userId,
      details: { from: roleLogKey(from), to: roleLogKey(next), fromRoleId: existing.roleId, toRoleId: next.id, scope: "event" },
      req,
    });
    await notifyRoleChanged({ userId: updated.userId, eventId, from, to: next, actorId: session.user.id });
    return NextResponse.json({
      membership: { id: updated.id, userId: updated.userId, eventId, role: { id: next.id, name: next.name, systemKey: next.systemKey } },
    });
  }),
);

export const DELETE = withEventAuth({ permission: "event.members.manage" }, async (req, { orgId, eventId, session }, extra) => {
  const membershipId = await membershipIdOf(extra);
  const existing = await prisma.eventMembership.findUnique({
    where: { id: membershipId },
    include: { roleRef: { select: { id: true, name: true, systemKey: true } } },
  });
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
    details: { role: roleLogKey(roleView(existing.roleRef, existing.role)), roleId: existing.roleId, scope: "event" },
    req,
  });
  return new NextResponse(null, { status: 204 });
});
