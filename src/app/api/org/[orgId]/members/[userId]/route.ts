import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { withOrgAuth } from "@/lib/with-org-auth";
import { assertNotLastOwner } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity-log";
import {
  RoleError,
  actorContext,
  assertCanAssignRole,
  holdsSystemRole,
  notifyRoleChanged,
  orgRoleColumns,
  resolveAssignableRole,
  roleLogKey,
  roleView,
  withRoleErrors,
} from "@/lib/role-management";
import type { UserContext } from "@/types/auth";

const userIdOf = async (extra: unknown) => (await (extra as { params: Promise<{ userId: string }> }).params).userId;

const patchSchema = z.object({ roleId: z.string().min(1) }).strict();

const dto = (id: string, userId: string, orgId: string, role: { id: string; name: string; systemKey: string | null }) => ({
  id,
  userId,
  orgId,
  role: { id: role.id, name: role.name, systemKey: role.systemKey },
});

const MEMBERSHIP_INCLUDE = { roleRef: { select: { id: true, name: true, systemKey: true } } } as const;

/** Modifier ou retirer un autre titulaire du rôle OWNER exige `users.permissions.manage` (staff SUPER_ADMIN). */
function assertMayTouchOwner(actor: UserContext, targetIsOwner: boolean, targetUserId: string): void {
  if (targetIsOwner && targetUserId !== actor.user.id && !hasPermission(actor, "users.permissions.manage", { kind: "platform" })) {
    throw new RoleError("OWNER_PROTECTED");
  }
}

export const PATCH = withOrgAuth("org.members.manage", (req, { orgId, session }, extra) =>
  withRoleErrors(async () => {
    const userId = await userIdOf(extra);
    const json = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }

    const existing = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      include: MEMBERSHIP_INCLUDE,
    });
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    // Personne ne modifie son propre rôle.
    if (userId === session.user.id) throw new RoleError("SELF_MODIFICATION");
    const actor = await actorContext(session.user.id);
    const wasOwner = holdsSystemRole(existing.roleRef, existing.role, "OWNER");
    assertMayTouchOwner(actor, wasOwner, userId);

    const next = await resolveAssignableRole(parsed.data.roleId, { scope: "ORG", orgId });
    assertCanAssignRole(actor, next, { kind: "org", orgId });
    const from = roleView(existing.roleRef, existing.role);
    if (existing.roleId === next.id) return NextResponse.json({ membership: dto(existing.id, userId, orgId, next) });

    // Garde-fou : on ne rétrograde pas le dernier propriétaire actif.
    if (wasOwner && next.systemKey !== "OWNER") await assertNotLastOwner(orgId, userId);

    const updated = await prisma.orgMembership.update({
      where: { id: existing.id },
      // @deprecated compat chantier roles-permissions (retiré à la fusion) : roleId double l'enum.
      data: orgRoleColumns(next),
    });

    await logActivity({
      type: "MEMBERSHIP_ROLE_CHANGED",
      userId: session.user.id,
      orgId,
      targetId: userId,
      details: { from: roleLogKey(from), to: roleLogKey(next), fromRoleId: existing.roleId, toRoleId: next.id, scope: "org" },
      req,
    });

    await notifyRoleChanged({ userId, orgId, from, to: next, actorId: session.user.id });

    return NextResponse.json({ membership: dto(updated.id, userId, orgId, next) });
  }),
);

export const DELETE = withOrgAuth("org.members.manage", (req, { orgId, session }, extra) =>
  withRoleErrors(async () => {
    const userId = await userIdOf(extra);
    const target = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      include: MEMBERSHIP_INCLUDE,
    });
    if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const isOwner = holdsSystemRole(target.roleRef, target.role, "OWNER");
    const actor = await actorContext(session.user.id);
    assertMayTouchOwner(actor, isOwner, userId);
    // ADR 2026-06-01 (v2-14 Task 2) : le dernier propriétaire actif ne peut pas être retiré.
    if (isOwner) await assertNotLastOwner(orgId, userId);

    await prisma.orgMembership.delete({ where: { id: target.id } });
    await logActivity({
      type: "MEMBERSHIP_REMOVED",
      userId: session.user.id,
      orgId,
      targetId: userId,
      details: { role: roleLogKey(roleView(target.roleRef, target.role)), roleId: target.roleId },
      req,
    });

    return new NextResponse(null, { status: 204 });
  }),
);
