import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";

type Params = { id: string };

const patchSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  scope: z.enum(["PROFILE", "REGISTRATION", "BOTH"]).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const PATCH = withStaffAuth<Params>(
  async (req, { session }, extra) => {
    const { id } = await extra.params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }
    const existing = await prisma.rejectionReason.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const reason = await prisma.rejectionReason.update({ where: { id }, data: parsed.data });
    await logActivity({
      type: "REJECTION_REASON_UPDATED",
      userId: session.user.id,
      targetId: reason.id,
      details: { fields: Object.keys(parsed.data) },
      req,
    });
    return NextResponse.json({ reason });
  },
  { minRole: "STAFF_ADMIN" },
);

export const DELETE = withStaffAuth<Params>(
  async (req, { session }, extra) => {
    const { id } = await extra.params;
    const existing = await prisma.rejectionReason.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    // Soft delete : un motif archive disparait des listes mais reste reference par
    // l'historique des decisions (le libelle y est de toute facon fige).
    await prisma.rejectionReason.update({
      where: { id },
      data: { archived: true, archivedAt: new Date() },
    });
    await logActivity({
      type: "REJECTION_REASON_ARCHIVED",
      userId: session.user.id,
      targetId: id,
      req,
    });
    return NextResponse.json({ ok: true });
  },
  { minRole: "STAFF_ADMIN" },
);
