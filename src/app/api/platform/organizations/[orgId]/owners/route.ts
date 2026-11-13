import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { systemRoleId } from "@/lib/permissions/db";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { sendUserInvitation } from "@/lib/mail";
import { assertNotLastOwner } from "@/lib/auth-guards";
import {
  RoleError,
  actorContext,
  assertCanAssignRole,
  notifyRoleAssigned,
  notifyRoleChanged,
  orgRoleColumns,
  roleLogKey,
  resolveAssignableRole,
  withRoleErrors,
} from "@/lib/role-management";

// ADR 2026-06-01 (v2-14 Task 5) : endpoints staff pour gerer les OWNERs d'une org.
// Permet d'inviter / lister sans devoir entrer dans l'espace org.

export const GET = withStaffAuth(
  async (_req, _ctx, { params }) => {
    const { orgId } = await params;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!org) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const memberships = await prisma.orgMembership.findMany({
      where: { orgId, OR: [{ roleRef: { systemKey: "OWNER" } }, { roleId: null, role: "OWNER" }] },
      include: {
        roleRef: { select: { id: true, name: true, systemKey: true } },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            archived: true,
            archivedAt: true,
            emailVerifiedAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      owners: memberships.map((m) => ({
        membershipId: m.id,
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        archived: m.user.archived,
        emailVerified: !!m.user.emailVerifiedAt,
        invitedAt: m.createdAt,
        role: m.roleRef ?? { id: null, name: "Propriétaire", systemKey: "OWNER" },
      })),
    });
  },
  { permission: "organizations.read" },
);

const inviteSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((s) => s.toLowerCase().trim()),
    name: z.string().min(1).max(120),
    // Rôle d'organisation (système ou personnalisé de cette organisation) ; propriétaire par défaut.
    roleId: z.string().min(1).optional(),
  })
  .strict();

export const POST = withStaffAuth(
  (req, { session }, { params }) =>
    withRoleErrors(async () => {
      const { orgId } = await params;
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true },
      });
      if (!org) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

      const json = await req.json().catch(() => null);
      const parsed = inviteSchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "VALIDATION", issues: parsed.error.issues },
          { status: 400 },
        );
      }
      const { email, name } = parsed.data;
      const role = await resolveAssignableRole(parsed.data.roleId ?? (await systemRoleId(prisma, "OWNER")), {
        scope: "ORG",
        orgId,
      });
      let user = await prisma.user.findUnique({ where: { email } });
      // Personne ne modifie son propre rôle (vérifié avant l'anti-escalade, qui ne dirait pas pourquoi).
      if (user?.id === session.user.id) {
        const own = await prisma.orgMembership.findUnique({ where: { userId_orgId: { userId: user.id, orgId } }, select: { roleId: true } });
        if (own) throw new RoleError("SELF_MODIFICATION");
      }
      const actor = await actorContext(session.user.id);
      assertCanAssignRole(actor, role, { kind: "org", orgId });

      let isNewUser = false;
      if (!user) {
        isNewUser = true;
        const inviteToken = randomBytes(24).toString("hex");
        const inviteTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        user = await prisma.user.create({
          data: {
            email,
            name,
            password: "",
            inviteToken,
            inviteTokenExpiry,
          },
        });
        await logActivity({
          type: "USER_CREATED",
          userId: session.user.id,
          orgId,
          targetId: user.id,
          details: { email, name, viaStaffOwnerInvite: true },
          req,
        });
      }

      const existing = await prisma.orgMembership.findUnique({
        where: { userId_orgId: { userId: user.id, orgId } },
        include: { roleRef: { select: { id: true, name: true, systemKey: true } } },
      });
      if (existing) {
        const sameRole = existing.roleId !== null ? existing.roleId === role.id : existing.role !== null && existing.role === role.systemKey;
        if (sameRole) {
          return NextResponse.json({ ok: true, alreadyMember: true });
        }
        // Rétrograder le dernier propriétaire est refusé.
        const wasOwner = existing.roleRef ? existing.roleRef.systemKey === "OWNER" : existing.role === "OWNER";
        if (wasOwner && role.systemKey !== "OWNER") {
          await assertNotLastOwner(orgId, user.id);
        }
        await prisma.orgMembership.update({
          where: { id: existing.id },
          // @deprecated compat chantier roles-permissions (retiré à la fusion) : roleId double l'enum.
          data: orgRoleColumns(role),
        });
        const from = existing.roleRef ?? { systemKey: existing.role, name: existing.role ?? "Aucun rôle" };
        await logActivity({
          type: "MEMBERSHIP_ROLE_CHANGED",
          userId: session.user.id,
          orgId,
          targetId: user.id,
          details: { from: roleLogKey(from), to: roleLogKey(role), fromRoleId: existing.roleId, toRoleId: role.id, scope: "org" },
          req,
        });
        await notifyRoleChanged({ userId: user.id, orgId, actorId: session.user.id, from, to: role });
        return NextResponse.json({ ok: true, upgraded: true });
      }

      await prisma.orgMembership.create({ data: { userId: user.id, orgId, ...orgRoleColumns(role) } });
      await logActivity({
        type: "MEMBERSHIP_ADDED",
        userId: session.user.id,
        orgId,
        targetId: user.id,
        details: { role: roleLogKey(role), roleId: role.id, isNewUser, viaStaff: true },
        req,
      });
      await notifyRoleAssigned({
        userId: user.id,
        orgId,
        role,
        actorId: session.user.id,
        invitationSent: isNewUser,
      });

      if (isNewUser) {
        try {
          await sendUserInvitation(user.id, { orgId, role: role.systemKey ?? undefined });
        } catch (err) {
          console.error("[staff invite member] email failed", err);
        }
      }

      return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
    }),
  { permission: "organizations.members.manage" },
);
