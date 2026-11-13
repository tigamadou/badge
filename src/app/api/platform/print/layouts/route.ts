import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import { layoutInputSchema } from "@/lib/print-sheets/layout-input";

export const GET = withStaffAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const archived = searchParams.get("archived") === "true";
  const layouts = await prisma.printSheetLayout.findMany({
    where: { archived },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ layouts });
}, { permission: "print.layouts.read" });

export const POST = withStaffAuth(
  async (req, { session }) => {
    const body = await req.json().catch(() => null);
    const parsed = layoutInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    try {
      const layout = await prisma.printSheetLayout.create({
        data: { ...parsed.data, createdById: session.user.id },
      });
      await logActivity({
        type: "PRINT_LAYOUT_CREATED",
        userId: session.user.id,
        targetId: layout.id,
        details: { name: layout.name },
        req,
      });
      return NextResponse.json({ layout }, { status: 201 });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "NAME_TAKEN" }, { status: 409 });
      }
      throw err;
    }
  },
  { permission: "print.layouts.manage" },
);
