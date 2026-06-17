import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { sendUserInvitation } from "@/lib/mail";
import { staffRoleAtLeast } from "@/lib/auth-helpers";
import { loadUserContext } from "@/lib/user-context";

// =====================================================
//  GET /api/staff/users : liste paginee, filtres q/type/archived
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
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20),
  );

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
        staffRole: true,
        archived: true,
        archivedAt: true,
        createdAt: true,
        _count: { select: { orgMemberships: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, pageSize });
});

// =====================================================
//  POST /api/staff/users : creation user (staff ou client)
// =====================================================

const STAFF_ROLES = ["SUPER_ADMIN", "STAFF_ADMIN", "STAFF_SUPPORT", "STAFF_OBSERVER"] as const;
const ORG_ROLES = ["OWNER", "MANAGER", "AUDITOR"] as const;

const createUserSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1).max(120),
    type: z.enum(["staff", "client"]),
    staffRole: z.enum(STAFF_ROLES).optional(),
    orgId: z.string().min(1).optional(),
    orgRole: z.enum(ORG_ROLES).optional(),
    orgMemberships: z
      .array(
        z.object({
          orgId: z.string().min(1),
          role: z.enum(ORG_ROLES),
        }),
      )
      .optional(),
  })
  .refine((d) => (d.type === "staff" ? !!d.staffRole : true), {
    message: "staffRole required when type=staff",
    path: ["staffRole"],
  });

export const POST = withStaffAuth(async (req, { session }) => {
  const ctx = await loadUserContext(session.user.id);
  if (!ctx || !ctx.isStaff || !ctx.staffRole) {
    return NextResponse.json({ error: "NOT_STAFF" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { email, name, type, staffRole, orgId, orgRole, orgMemberships } = parsed.data;

  // STAFF_OBSERVER : aucune ecriture (read-only)
  if (!staffRoleAtLeast(ctx.staffRole, "STAFF_SUPPORT")) {
    return NextResponse.json({ error: "INSUFFICIENT_STAFF_ROLE" }, { status: 403 });
  }

  // STAFF_SUPPORT ne peut creer que des clients
  if (type === "staff" && !staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN")) {
    return NextResponse.json({ error: "STAFF_ADMIN_REQUIRED" }, { status: 403 });
  }

  // STAFF_ADMIN ne peut pas creer un STAFF_ADMIN ou SUPER_ADMIN.
  if (
    type === "staff" &&
    (staffRole === "STAFF_ADMIN" || staffRole === "SUPER_ADMIN") &&
    ctx.staffRole !== "SUPER_ADMIN"
  ) {
    return NextResponse.json({ error: "SUPER_ADMIN_REQUIRED" }, { status: 403 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }

  // Construire la liste des memberships a creer (deux APIs acceptees :
  // - orgMemberships: [{ orgId, role }, ...]
  // - orgId + orgRole (raccourci pour un seul membership)
  const memberships: { orgId: string; role: (typeof ORG_ROLES)[number] }[] = [];
  if (type === "client") {
    if (orgMemberships && orgMemberships.length > 0) {
      memberships.push(...orgMemberships);
    } else if (orgId) {
      memberships.push({ orgId, role: orgRole ?? "OWNER" });
    }
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
        isStaff: type === "staff",
        staffRole: type === "staff" ? staffRole! : null,
      },
    });

    for (const m of memberships) {
      await tx.orgMembership.create({
        data: { userId: user.id, orgId: m.orgId, role: m.role },
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
      staffRole: staffRole ?? null,
    },
    req,
  });
  for (const m of memberships) {
    await logActivity({
      type: "MEMBERSHIP_ADDED",
      userId: session.user.id,
      targetId: created.id,
      orgId: m.orgId,
      details: { role: m.role },
      req,
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
        staffRole: created.staffRole,
      },
    },
    { status: 201 },
  );
});
