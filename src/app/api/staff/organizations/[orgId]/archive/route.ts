import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

export const POST = withStaffAuth<{ orgId: string }>(
  async (req, { session }, extra) => {
    const { orgId } = await extra.params;
    try {
      await prisma.organization.update({
        where: { id: orgId },
        data: { archived: true, archivedAt: new Date() },
      });
      await logActivity({
        type: "ORG_ARCHIVED",
        userId: session.user.id,
        orgId,
        req,
      });
      return NextResponse.json({ ok: true });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "P2025") {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }
      throw err;
    }
  },
  { minRole: "STAFF_ADMIN" },
);
