import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { loadUserContext } from "@/lib/user-context";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { AuthError, assertNotLastSuperAdmin } from "@/lib/auth-guards";

// =====================================================
//  GET /api/staff/users/[userId]
// =====================================================

export const GET = withStaffAuth<{ userId: string }>(async (_req, _ctx, extra) => {
  const { userId } = await extra.params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isStaff: true,
      staffRole: true,
      archived: true,
      archivedAt: true,
      createdAt: true,
      inviteTokenExpiry: true,
      orgMemberships: {
        select: {
          role: true,
          organization: { select: { id: true, name: true, slug: true, archived: true } },
        },
      },
      eventMemberships: {
        select: {
          role: true,
          event: { select: { id: true, title: true, slug: true, orgId: true } },
        },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ user });
});

// =====================================================
//  PATCH /api/staff/users/[userId]
// =====================================================

const STAFF_ROLES = ["SUPER_ADMIN", "STAFF_ADMIN", "STAFF_SUPPORT", "STAFF_OBSERVER"] as const;

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    archived: z.boolean().optional(),
    staffRole: z.enum(STAFF_ROLES).nullable().optional(),
  })
  .strict();

export const PATCH = withStaffAuth<{ userId: string }>(async (req, { session }, extra) => {
  const { userId } = await extra.params;
  const ctx = await loadUserContext(session.user.id);
  if (!ctx || !ctx.isStaff || !ctx.staffRole) {
    return NextResponse.json({ error: "NOT_STAFF" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
  }

  // Toute modification de role/archive necessite au moins STAFF_ADMIN.
  if (
    (data.staffRole !== undefined || data.archived !== undefined) &&
    !staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN")
  ) {
    return NextResponse.json({ error: "STAFF_ADMIN_REQUIRED" }, { status: 403 });
  }

  // Pas de modification de son propre staffRole ni de son propre archived.
  if ((data.staffRole !== undefined || data.archived !== undefined) && userId === session.user.id) {
    return NextResponse.json({ error: "CANNOT_CHANGE_SELF" }, { status: 403 });
  }

  // Cible : recuperer le user pour les regles role.
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, staffRole: true, isStaff: true, archived: true },
  });
  if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Regles de promotion / demotion role staff.
  if (data.staffRole !== undefined) {
    const newRole = data.staffRole;
    const oldRole = target.staffRole;

    const involvesTopRoles =
      newRole === "STAFF_ADMIN" ||
      newRole === "SUPER_ADMIN" ||
      oldRole === "STAFF_ADMIN" ||
      oldRole === "SUPER_ADMIN";
    if (involvesTopRoles && ctx.staffRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "SUPER_ADMIN_REQUIRED" }, { status: 403 });
    }

    // Si la cible perdait le SUPER_ADMIN, garder au moins un SUPER_ADMIN actif.
    if (oldRole === "SUPER_ADMIN" && newRole !== "SUPER_ADMIN") {
      try {
        await assertNotLastSuperAdmin(userId);
      } catch (err) {
        if (err instanceof AuthError) {
          return NextResponse.json({ error: err.code }, { status: err.httpStatus });
        }
        throw err;
      }
    }
  }

  // Archiver un SUPER_ADMIN : ne pas retirer le dernier.
  if (data.archived === true && target.staffRole === "SUPER_ADMIN") {
    try {
      await assertNotLastSuperAdmin(userId);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.code }, { status: err.httpStatus });
      }
      throw err;
    }
  }

  const updateData: {
    name?: string;
    archived?: boolean;
    archivedAt?: Date | null;
    staffRole?: (typeof STAFF_ROLES)[number] | null;
    isStaff?: boolean;
  } = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.archived !== undefined) {
    updateData.archived = data.archived;
    updateData.archivedAt = data.archived ? new Date() : null;
  }
  if (data.staffRole !== undefined) {
    updateData.staffRole = data.staffRole;
    updateData.isStaff = data.staffRole !== null;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        isStaff: true,
        staffRole: true,
        archived: true,
        archivedAt: true,
      },
    });

    await logActivity({
      type: "USER_UPDATED",
      userId: session.user.id,
      targetId: userId,
      details: data,
      req,
    });

    return NextResponse.json({ user: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    throw err;
  }
});

// =====================================================
//  DELETE /api/staff/users/[userId] : soft delete (archive)
// =====================================================

export const DELETE = withStaffAuth<{ userId: string }>(
  async (req, { session }, extra) => {
    const { userId } = await extra.params;
    if (userId === session.user.id) {
      return NextResponse.json({ error: "CANNOT_ARCHIVE_SELF" }, { status: 403 });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, staffRole: true, archived: true },
    });
    if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    if (target.staffRole === "SUPER_ADMIN") {
      try {
        await assertNotLastSuperAdmin(userId);
      } catch (err) {
        if (err instanceof AuthError) {
          return NextResponse.json({ error: err.code }, { status: err.httpStatus });
        }
        throw err;
      }
    }

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
  },
  { minRole: "STAFF_ADMIN" },
);
