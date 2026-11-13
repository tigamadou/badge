import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { createGeneration, GenerationError } from "@/lib/print-sheets/generations";
import { EventImagesNoncompliantError, eventImagesErrorResponse } from "@/lib/event-image-compliance";

const id = z.string().min(1);

const bodySchema = z.object({
  eventId: id,
  layoutId: id,
  selection: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("ALL") }),
    z.object({ mode: z.literal("CATEGORIES"), categoryIds: z.array(id) }),
    // Avec printRequestId : tous les badges de la commande, lus côté serveur.
    z.object({ mode: z.literal("REQUEST") }),
    z.object({ mode: z.literal("IDS"), registrationIds: z.array(id).max(5000) }),
  ]),
  duplex: z.boolean().default(false),
  printRequestId: id.optional(),
});

export const GET = withStaffAuth(
  async (req) => {
    const eventId = new URL(req.url).searchParams.get("eventId");
    const generations = await prisma.printSheetGeneration.findMany({
      // Generation libre : planches hors commande (les archives ZIP ont leur ecran, les planches
      // de commande sont servies par /orders).
      where: { output: "SHEETS", printRequestId: null, ...(eventId ? { eventId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
      // Sans registrationIds (jusqu'a 5000 ids) ni layoutSnapshot : liste rafraichie toutes les 5 s.
      select: {
        id: true,
        output: true,
        eventId: true,
        layoutId: true,
        duplex: true,
        status: true,
        sheetCount: true,
        badgeCount: true,
        skippedIds: true,
        fileKey: true,
        error: true,
        createdById: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        event: { select: { id: true, title: true } },
        layout: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ generations });
  },
  { permission: "print.sheets.read" },
);

export const POST = withStaffAuth(
  async (req, { session }) => {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    try {
      const generation = await createGeneration({ ...parsed.data, userId: session.user.id });
      return NextResponse.json({ generation }, { status: 201 });
    } catch (err) {
      if (err instanceof EventImagesNoncompliantError) return eventImagesErrorResponse(err);
      if (err instanceof GenerationError) {
        return NextResponse.json({ error: err.code, message: err.message }, { status: err.httpStatus });
      }
      throw err;
    }
  },
  { permission: "print.sheets.generate" },
);
