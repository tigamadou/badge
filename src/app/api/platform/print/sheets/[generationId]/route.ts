import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";

// Statut d'une generation, interroge par l'ecran pour se rafraichir.
export const GET = withStaffAuth<{ generationId: string }>(
  async (_req, _ctx, { params }) => {
    const { generationId } = await params;
    const generation = await prisma.printSheetGeneration.findUnique({
      where: { id: generationId },
    });
    if (!generation) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ generation });
  },
  { minRole: "STAFF_SUPPORT" },
);
