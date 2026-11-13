import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { assertNotLastOwner, AuthError } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity-log";

// ADR 2026-06-01 (v2-14 Task 5) : retire un OWNER d'une org via staff.
// Garde-fou last-owner via assertNotLastOwner (filtre archived).

export const DELETE = withStaffAuth(
  async (req, { session }, { params }) => {
    const { orgId, userId } = await params;
    const target = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId, orgId } },
      include: { roleRef: { select: { systemKey: true } } },
    });
    if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    // Propriétaire = titulaire du rôle système OWNER (repli sur l'enum tant que roleId est nul).
    const isOwner = target.roleRef ? target.roleRef.systemKey === "OWNER" : target.role === "OWNER";
    if (!isOwner) {
      return NextResponse.json(
        { error: "NOT_OWNER", message: "Cet utilisateur n'est pas OWNER." },
        { status: 409 },
      );
    }

    try {
      await assertNotLastOwner(orgId, userId);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json(
          { error: err.code, message: "Dernier OWNER : impossible de retirer." },
          { status: err.httpStatus },
        );
      }
      throw err;
    }

    await prisma.orgMembership.delete({ where: { id: target.id } });
    await logActivity({
      type: "MEMBERSHIP_REMOVED",
      userId: session.user.id,
      orgId,
      targetId: userId,
      details: { role: "OWNER", viaStaff: true },
      req,
    });

    return new NextResponse(null, { status: 204 });
  },
  { permission: "organizations.members.manage" },
);
