import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";

// Statut d'une generation, interroge par l'ecran pour se rafraichir.
export const GET = withStaffAuth<{ generationId: string }>(
  async (_req, _ctx, { params }) => {
    const { generationId } = await params;
    const generation = await prisma.printSheetGeneration.findUnique({
      where: { id: generationId },
      // Sans registrationIds (volumineux) ni lockedBy : appelé à chaque rafraîchissement.
      select: {
        id: true,
        output: true,
        eventId: true,
        layoutId: true,
        duplex: true,
        status: true,
        attempts: true,
        sheetCount: true,
        badgeCount: true,
        skippedIds: true,
        fileKey: true,
        error: true,
        createdById: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        heartbeatAt: true,
      },
    });
    if (!generation) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ generation });
  },
  { permission: "print.sheets.read" },
);
