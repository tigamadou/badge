import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { withOrgAuth } from "@/lib/with-org-auth";
import { logActivity } from "@/lib/activity-log";
import { sendUserInvitation } from "@/lib/mail";
import { notifyOrgMembershipAdded } from "@/lib/notifications/triggers";

// ADR 2026-06-01 (v2-14 Task 2) : lecture liste membres autorisee a tous les roles org
// (OWNER, MANAGER, AUDITOR). La mutation (POST) reste OWNER-only.
export const GET = withOrgAuth("AUDITOR", async (_req, { orgId }) => {
  const memberships = await prisma.orgMembership.findMany({
    where: { orgId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          archived: true,
          activityLogs: {
            where: { type: "USER_LOGIN" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const items = memberships.map((m) => ({
    id: m.id,
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    archived: m.user.archived,
    role: m.role,
    invitedAt: m.createdAt,
    lastLoginAt: m.user.activityLogs[0]?.createdAt ?? null,
  }));
  return NextResponse.json({ members: items });
});

const inviteSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((s) => s.toLowerCase().trim()),
    name: z.string().min(1).max(120),
    role: z.enum(["OWNER", "MANAGER", "AUDITOR"]).default("OWNER"),
  })
  .strict();

export const POST = withOrgAuth("OWNER", async (req, { orgId, session }) => {
  const json = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { email, name, role } = parsed.data;

  let user = await prisma.user.findUnique({ where: { email } });
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
      details: { email, name, viaOrgInvite: true },
      req,
    });
  }

  const existingMembership = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId: user.id, orgId } },
  });
  if (existingMembership) {
    return NextResponse.json({ ok: true, alreadyMember: true }, { status: 200 });
  }

  await prisma.orgMembership.create({ data: { userId: user.id, orgId, role } });

  await logActivity({
    type: "MEMBERSHIP_ADDED",
    userId: session.user.id,
    orgId,
    targetId: user.id,
    details: { role, isNewUser },
    req,
  });

  await notifyOrgMembershipAdded({
    userId: user.id,
    orgId,
    role,
    actorId: session.user.id,
    invitationSent: isNewUser,
  });

  // Plan 6 : sendUserInvitation regenere un inviteToken. On ne l'appelle que pour
  // un nouvel utilisateur (invitation complete). Pour un user existant, le plan
  // prevoit un simple email d'information (a livrer par Plan 6, sans toucher au token).
  if (isNewUser) {
    try {
      await sendUserInvitation(user.id, { orgId });
    } catch (err) {
      console.error("[invite] email failed", err);
    }
  }

  return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
});
