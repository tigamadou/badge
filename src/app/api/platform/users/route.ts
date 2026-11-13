import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { parseListPage } from "@/lib/list-query";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { sendUserInvitation } from "@/lib/mail";
import { hasPermission } from "@/lib/permissions";
import { systemRoleId } from "@/lib/permissions/db";
import {
  actorContext,
  assertCanAssignRole,
  isTopPlatformRole,
  notifyRoleAssigned,
  orgRoleColumns,
  resolveAssignableRole,
  roleLogKey,
  staffRoleColumns,
  withRoleErrors,
  RoleError,
  type RoleDTO,
} from "@/lib/role-management";

// =====================================================
//  GET /api/platform/users : liste paginee, filtres q/type/archived
// =====================================================

export const GET = withStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const type = searchParams.get("type") ?? "all";
  const archivedParam = searchParams.get("archived");
  const archivedFilter =
    archivedParam === "all"
      ? undefined
      : archivedParam === "true"
        ? true
        : false;
  const { page, pageSize, skip, take } = parseListPage(searchParams);

  const where: Prisma.UserWhereInput = {
    ...(archivedFilter !== undefined && { archived: archivedFilter }),
    ...(type === "staff" && { isStaff: true }),
    ...(type === "client" && { isStaff: false }),
    ...(q && {
      OR: [
        { email: { contains: q } },
        { name: { contains: q } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        isStaff: true,
        platformRole: { select: { id: true, name: true, systemKey: true } },
        archived: true,
        archivedAt: true,
        createdAt: true,
        _count: { select: { orgMemberships: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, pageSize });
}, { permission: "users.read" });

// =====================================================
//  POST /api/platform/users : creation user (staff ou client)
// =====================================================

const createUserSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1).max(120),
    type: z.enum(["staff", "client"]),
    platformRoleId: z.string().min(1).optional(),
    orgId: z.string().min(1).optional(),
    orgRoleId: z.string().min(1).optional(),
    orgMemberships: z
      .array(
        z.object({
          orgId: z.string().min(1),
          roleId: z.string().min(1),
        }),
      )
      .optional(),
  })
  .strict()
  .refine((d) => (d.type === "staff" ? !!d.platformRoleId : true), {
    message: "platformRoleId required when type=staff",
    path: ["platformRoleId"],
  });

export const POST = withStaffAuth(
  (req, { session }) =>
    withRoleErrors(async () => {
      const actor = await actorContext(session.user.id);
      const platform = { kind: "platform" } as const;

      const body = await req.json().catch(() => null);
      const parsed = createUserSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
      }
      const { email, name, type, platformRoleId, orgId, orgRoleId, orgMemberships } = parsed.data;

      // Un client se crée avec `users.create`, un compte staff avec `users.staff.create`.
      if (!hasPermission(actor, type === "staff" ? "users.staff.create" : "users.create", platform)) {
        return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
      }

      let platformRole: RoleDTO | null = null;
      if (type === "staff") {
        platformRole = await resolveAssignableRole(platformRoleId!, { scope: "PLATFORM" });
        if (isTopPlatformRole(platformRole.systemKey) && !hasPermission(actor, "users.staff.assign_top_role", platform)) {
          return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
        }
        assertCanAssignRole(actor, platformRole, platform);
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
      }

      // Adhésions : `orgMemberships` ou le raccourci `orgId` + `orgRoleId` (propriétaire par défaut).
      const requested: { orgId: string; roleId: string }[] = [];
      if (type === "client") {
        if (orgMemberships && orgMemberships.length > 0) {
          requested.push(...orgMemberships);
        } else if (orgId) {
          requested.push({ orgId, roleId: orgRoleId ?? (await systemRoleId(prisma, "OWNER")) });
        }
      }
      // Rattacher un compte à une organisation (OWNER par défaut) relève de la gestion des membres d'organisation.
      if (requested.length > 0 && !hasPermission(actor, "organizations.members.manage", platform)) {
        return NextResponse.json({ error: "PERMISSION_DENIED" }, { status: 403 });
      }
      const memberships: { orgId: string; role: RoleDTO }[] = [];
      for (const m of requested) {
        const org = await prisma.organization.findUnique({ where: { id: m.orgId }, select: { id: true } });
        if (!org) throw new RoleError("NOT_FOUND", "organisation");
        const role = await resolveAssignableRole(m.roleId, { scope: "ORG", orgId: m.orgId });
        assertCanAssignRole(actor, role, { kind: "org", orgId: m.orgId });
        memberships.push({ orgId: m.orgId, role });
      }

      // Mot de passe aleatoire hashe en bcrypt 12 rounds.
      // L'utilisateur se connectera via setup-password (inviteToken).
      const randomPassword = randomBytes(24).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            password: passwordHash,
            name,
            ...staffRoleColumns(platformRole),
          },
        });

        for (const m of memberships) {
          await tx.orgMembership.create({
            data: { userId: user.id, orgId: m.orgId, ...orgRoleColumns(m.role) },
          });
        }

        return user;
      });

      const firstOrgId = memberships[0]?.orgId;
      await logActivity({
        type: "USER_CREATED",
        userId: session.user.id,
        targetId: created.id,
        orgId: firstOrgId,
        details: {
          email: created.email,
          name: created.name,
          kind: type,
          platformRole: platformRole?.name ?? null,
        },
        req,
      });
      for (const m of memberships) {
        await logActivity({
          type: "MEMBERSHIP_ADDED",
          userId: session.user.id,
          targetId: created.id,
          orgId: m.orgId,
          details: { role: roleLogKey(m.role), roleId: m.role.id },
          req,
        });
        await notifyRoleAssigned({
          userId: created.id,
          orgId: m.orgId,
          role: m.role,
          actorId: session.user.id,
          invitationSent: true,
        });
      }

      // Genere inviteToken sur User (envoi email = stub Plan 6)
      await sendUserInvitation(created.id, { orgId: firstOrgId });

      return NextResponse.json(
        {
          user: {
            id: created.id,
            email: created.email,
            name: created.name,
            isStaff: created.isStaff,
            platformRole: platformRole && { id: platformRole.id, name: platformRole.name, systemKey: platformRole.systemKey },
          },
        },
        { status: 201 },
      );
    }),
  { permission: ["users.create", "users.staff.create"] },
);
