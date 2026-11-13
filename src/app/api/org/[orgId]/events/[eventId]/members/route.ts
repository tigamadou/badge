import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { eventTargetOf } from "@/lib/permissions";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { sendUserInvitation } from "@/lib/mail";
import {
  actorContext,
  assertCanAssignRole,
  eventRoleColumns,
  notifyRoleAssigned,
  resolveAssignableRole,
  roleLogKey,
  roleView,
  withRoleErrors,
} from "@/lib/role-management";

export const GET = withEventAuth({ permission: "event.members.manage", allowArchived: true }, async (_req, { eventId }) => {
  const members = await prisma.eventMembership.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      roleRef: { select: { id: true, name: true, systemKey: true } },
      createdAt: true,
      user: { select: { id: true, email: true, name: true, isStaff: true } },
    },
  });
  return NextResponse.json({
    members: members.map(({ roleRef, role, ...m }) => ({ ...m, role: roleView(roleRef, role) })),
  });
});

const inviteSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1).max(200).optional(),
    roleId: z.string().min(1),
  })
  .strict();

export const POST = withEventAuth({ permission: "event.members.manage" }, (req, { orgId, eventId, session }) =>
  withRoleErrors(async () => {
    const json = await req.json().catch(() => null);
    const parsed = inviteSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase().trim();

    // Rôle d'évènement (système ou personnalisé de l'organisation de l'évènement), puis anti-escalade.
    const role = await resolveAssignableRole(parsed.data.roleId, { scope: "EVENT", orgId });
    const actor = await actorContext(session.user.id);
    assertCanAssignRole(actor, role, eventTargetOf({ eventId, orgId }));

    let user = await prisma.user.findUnique({ where: { email } });
    const wasNew = !user;

    if (!user) {
      const inviteToken = randomBytes(32).toString("hex");
      const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      user = await prisma.user.create({
        data: {
          email,
          name: parsed.data.name ?? email.split("@")[0],
          password: randomBytes(16).toString("hex"),
          inviteToken,
          inviteTokenExpiry,
        },
      });
      await logActivity({
        type: "USER_CREATED",
        userId: session.user.id,
        orgId,
        eventId,
        targetId: user.id,
        details: { email, via: "event-invite" },
        req,
      });
    }

    try {
      const membership = await prisma.eventMembership.create({
        data: { eventId, userId: user.id, ...eventRoleColumns(role) },
      });
      await logActivity({
        type: "MEMBERSHIP_ADDED",
        userId: session.user.id,
        orgId,
        eventId,
        targetId: user.id,
        details: { membershipId: membership.id, role: roleLogKey(role), roleId: role.id, scope: "event" },
        req,
      });

      await notifyRoleAssigned({
        userId: user.id,
        eventId,
        role,
        actorId: session.user.id,
        invitationSent: wasNew,
      });

      if (wasNew) {
        try {
          await sendUserInvitation(user.id, { eventId, orgId, role: role.systemKey ?? undefined });
        } catch (e) {
          console.error("[mail] sendUserInvitation failed", e);
        }
      }

      return NextResponse.json(
        { membership: { id: membership.id, role: { id: role.id, name: role.name, systemKey: role.systemKey } } },
        { status: 201 },
      );
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "ALREADY_MEMBER", code: "ALREADY_MEMBER" }, { status: 409 });
      }
      throw err;
    }
  }),
);
