import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { hasPermission, type Permission } from "@/lib/permissions";
import { assertNotLastSuperAdmin } from "@/lib/auth-guards";
import {
  RoleError,
  actorContext,
  assertCanAssignRole,
  isTopPlatformRole,
  resolveAssignableRole,
  staffRoleColumns,
  withRoleErrors,
  type RoleDTO,
} from "@/lib/role-management";

const ROLE_SELECT = { id: true, name: true, systemKey: true } as const;

/** Clé du rôle système plateforme d'un compte (repli sur la colonne d'enum tant que `platformRoleId` est nul). */
function systemKeyOf(u: { platformRole: { systemKey: string | null } | null; platformRoleId: string | null; staffRole: string | null }) {
  return u.platformRoleId === null ? u.staffRole : (u.platformRole?.systemKey ?? null);
}

const platform = { kind: "platform" } as const;

// =====================================================
//  GET /api/platform/users/[userId]
// =====================================================

export const GET = withStaffAuth<{ userId: string }>(
  async (_req, _ctx, extra) => {
    const { userId } = await extra.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isStaff: true,
        platformRole: { select: ROLE_SELECT },
        archived: true,
        archivedAt: true,
        createdAt: true,
        inviteTokenExpiry: true,
        orgMemberships: {
          select: {
            roleRef: { select: ROLE_SELECT },
            organization: { select: { id: true, name: true, slug: true, archived: true } },
          },
        },
        eventMemberships: {
          select: {
            roleRef: { select: ROLE_SELECT },
            event: { select: { id: true, title: true, slug: true, orgId: true } },
          },
        },
      },
    });
    if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ user });
  },
  { permission: "users.read" },
);

// =====================================================
//  PATCH /api/platform/users/[userId]
// =====================================================

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    archived: z.boolean().optional(),
    platformRoleId: z.string().min(1).nullable().optional(),
  })
  .strict();

export const PATCH = withStaffAuth<{ userId: string }>(
  (req, { session }, extra) =>
    withRoleErrors(async () => {
      const { userId } = await extra.params;
      const actor = await actorContext(session.user.id);

      const body = await req.json().catch(() => null);
      const parsed = patchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
      }
      const data = parsed.data;
      if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
      }

      // Chaque champ exige sa propre permission.
      const required: Permission[] = [];
      if (data.name !== undefined) required.push("users.update");
      if (data.archived !== undefined) required.push("users.archive");
      if (data.platformRoleId !== undefined) required.push("users.staff.assign_role");
      if (required.some((p) => !hasPermission(actor, p, platform))) {
        return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
      }

      // Pas de modification de son propre rôle ni de son propre statut d'archivage.
      if ((data.platformRoleId !== undefined || data.archived !== undefined) && userId === session.user.id) {
        throw new RoleError("SELF_MODIFICATION");
      }

      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, staffRole: true, platformRoleId: true, platformRole: { select: ROLE_SELECT } },
      });
      if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      const oldKey = systemKeyOf(target);

      // Archiver ou restaurer un compte de rôle supérieur exige aussi `users.staff.assign_top_role`.
      if (data.archived !== undefined && isTopPlatformRole(oldKey) && !hasPermission(actor, "users.staff.assign_top_role", platform)) {
        return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
      }

      let newRole: RoleDTO | null | undefined;
      if (data.platformRoleId !== undefined) {
        newRole = data.platformRoleId === null ? null : await resolveAssignableRole(data.platformRoleId, { scope: "PLATFORM" });
        // Promouvoir vers (ou rétrograder depuis) un rôle supérieur exige `users.staff.assign_top_role`.
        if (
          (isTopPlatformRole(newRole?.systemKey ?? null) || isTopPlatformRole(oldKey)) &&
          !hasPermission(actor, "users.staff.assign_top_role", platform)
        ) {
          return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
        }
        if (newRole) assertCanAssignRole(actor, newRole, platform);
        // Si la cible perd le SUPER_ADMIN, garder au moins un SUPER_ADMIN actif.
        if (oldKey === "SUPER_ADMIN" && newRole?.systemKey !== "SUPER_ADMIN") {
          await assertNotLastSuperAdmin(userId);
        }
      }

      // Archiver un SUPER_ADMIN : ne pas retirer le dernier.
      if (data.archived === true && oldKey === "SUPER_ADMIN") {
        await assertNotLastSuperAdmin(userId);
      }

      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.archived !== undefined) {
        updateData.archived = data.archived;
        updateData.archivedAt = data.archived ? new Date() : null;
      }
      // Double écriture : enum et roleId (@deprecated compat chantier roles-permissions, retirée à la fusion).
      if (newRole !== undefined) Object.assign(updateData, staffRoleColumns(newRole));

      const updated = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          isStaff: true,
          platformRole: { select: ROLE_SELECT },
          archived: true,
          archivedAt: true,
        },
      });

      await logActivity({
        type: "USER_UPDATED",
        userId: session.user.id,
        targetId: userId,
        details: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.archived !== undefined ? { archived: data.archived } : {}),
          ...(newRole !== undefined
            ? { platformRole: { from: target.platformRole?.name ?? oldKey, to: newRole?.name ?? null } }
            : {}),
        },
        req,
      });

      return NextResponse.json({ user: updated });
    }),
  { permission: ["users.update", "users.archive", "users.staff.assign_role"] },
);

// =====================================================
//  DELETE /api/platform/users/[userId] : soft delete (archive)
// =====================================================

export const DELETE = withStaffAuth<{ userId: string }>(
  (req, { session }, extra) =>
    withRoleErrors(async () => {
      const { userId } = await extra.params;
      if (userId === session.user.id) throw new RoleError("SELF_MODIFICATION");

      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, staffRole: true, platformRoleId: true, platformRole: { select: ROLE_SELECT } },
      });
      if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

      const targetKey = systemKeyOf(target);
      const actor = await actorContext(session.user.id);
      if (isTopPlatformRole(targetKey) && !hasPermission(actor, "users.staff.assign_top_role", platform)) {
        return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
      }

      if (targetKey === "SUPER_ADMIN") await assertNotLastSuperAdmin(userId);

      await prisma.user.update({
        where: { id: userId },
        data: { archived: true, archivedAt: new Date() },
      });

      await logActivity({
        type: "USER_DELETED",
        userId: session.user.id,
        targetId: userId,
        details: { action: "soft-delete" },
        req,
      });

      return new NextResponse(null, { status: 204 });
    }),
  { permission: "users.archive" },
);
