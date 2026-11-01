import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { exportView } from "../view";

export const runtime = "nodejs";

type Params = { orgId: string; eventId: string; exportId: string };

// Statut d'un export ZIP, interrogé toutes les 3 s par le panneau de lot.
export const GET = withEventAuth(
  { permission: "badge.print", allowArchived: true },
  async (_req, { eventId }, extra) => {
    const { exportId } = (await extra.params) as Params;
    const generation = await prisma.printSheetGeneration.findUnique({
      where: { id: exportId },
      select: {
        id: true,
        output: true,
        eventId: true,
        status: true,
        badgeCount: true,
        fileKey: true,
        error: true,
        createdAt: true,
        completedAt: true,
      },
    });
    if (!generation || generation.eventId !== eventId || generation.output !== "ZIP") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ export: exportView(generation) });
  },
);
