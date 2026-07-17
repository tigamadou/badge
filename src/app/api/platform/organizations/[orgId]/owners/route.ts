import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { sendUserInvitation } from "@/lib/mail";

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
      where: { orgId, role: "OWNER" },
      include: {
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
      })),
    });
  },
  { minRole: "STAFF_OBSERVER" },
);

const inviteSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((s) => s.toLowerCase().trim()),
    name: z.string().min(1).max(120),
    // v4 Task 4.2 : le staff choisit le role du membre invite (defaut OWNER pour retrocompat).
    role: z.enum(["OWNER", "MANAGER", "AUDITOR"]).default("OWNER"),
  })
  .strict();

export const POST = withStaffAuth(
  async (req, { session }, { params }) => {
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
        details: { email, name, viaStaffOwnerInvite: true },
        req,
      });
    }

    const existing = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId } },
    });
    if (existing) {
      if (existing.role === role) {
        return NextResponse.json({ ok: true, alreadyMember: true });
      }
      // Ajuste le role du membership existant au role choisi par le staff.
      await prisma.orgMembership.update({
        where: { id: existing.id },
        data: { role },
      });
      await logActivity({
        type: "MEMBERSHIP_ROLE_CHANGED",
        userId: session.user.id,
        orgId,
        targetId: user.id,
        details: { from: existing.role, to: role, scope: "org" },
        req,
      });
      return NextResponse.json({ ok: true, upgraded: true });
    }

    await prisma.orgMembership.create({ data: { userId: user.id, orgId, role } });
    await logActivity({
      type: "MEMBERSHIP_ADDED",
      userId: session.user.id,
      orgId,
      targetId: user.id,
      details: { role, isNewUser, viaStaff: true },
      req,
    });

    if (isNewUser) {
      try {
        await sendUserInvitation(user.id, { orgId, role });
      } catch (err) {
        console.error("[staff invite member] email failed", err);
      }
    }

    return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
  },
  { minRole: "STAFF_ADMIN" },
);
