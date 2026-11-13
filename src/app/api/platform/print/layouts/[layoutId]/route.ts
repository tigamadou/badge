import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { logActivity } from "@/lib/activity-log";
import {
  layoutFieldsSchema,
  WIDTH_GT_HEIGHT_MESSAGE,
} from "@/lib/print-sheets/layout-input";

const updateSchema = layoutFieldsSchema.partial();

export const PATCH = withStaffAuth<{ layoutId: string }>(
  async (req, { session }, { params }) => {
    const { layoutId } = await params;
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const current = await prisma.printSheetLayout.findUnique({ where: { id: layoutId } });
    if (!current) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    // Controle de coherence sur la valeur fusionnee avec la ligne stockee.
    const width = data.sheetWidth ?? current.sheetWidth;
    const height = data.sheetHeight ?? current.sheetHeight;
    if (width > height) {
      return NextResponse.json(
        {
          error: "VALIDATION",
          issues: [{ path: ["sheetWidth"], message: WIDTH_GT_HEIGHT_MESSAGE }],
        },
        { status: 400 },
      );
    }

    const changed = (Object.keys(data) as (keyof typeof data)[]).filter(
      (k) => data[k] !== current[k],
    );

    try {
      const layout = await prisma.printSheetLayout.update({
        where: { id: layoutId },
        data,
      });
      await logActivity({
        type: "PRINT_LAYOUT_UPDATED",
        userId: session.user.id,
        targetId: layout.id,
        details: { name: layout.name, changed },
        req,
      });
      return NextResponse.json({ layout });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "NAME_TAKEN" }, { status: 409 });
      }
      throw err;
    }
  },
  { permission: "print.layouts.manage" },
);

// Archivage logique : jamais de suppression physique (les generations y font reference).
export const DELETE = withStaffAuth<{ layoutId: string }>(
  async (req, { session }, { params }) => {
    const { layoutId } = await params;
    const current = await prisma.printSheetLayout.findUnique({ where: { id: layoutId } });
    if (!current) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    // Idempotent : un gabarit deja archive garde sa date d'archivage.
    if (current.archived) return NextResponse.json({ layout: current });

    const layout = await prisma.printSheetLayout.update({
      where: { id: layoutId },
      data: { archived: true, archivedAt: new Date() },
    });
    await logActivity({
      type: "PRINT_LAYOUT_ARCHIVED",
      userId: session.user.id,
      targetId: layout.id,
      details: { name: layout.name },
      req,
    });
    return NextResponse.json({ layout });
  },
  { permission: "print.layouts.manage" },
);
