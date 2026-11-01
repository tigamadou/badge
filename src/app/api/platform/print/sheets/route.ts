import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { createGeneration, GenerationError } from "@/lib/print-sheets/generations";

const id = z.string().min(1);

const bodySchema = z.object({
  eventId: id,
  layoutId: id,
  selection: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("ALL") }),
    z.object({ mode: z.literal("CATEGORIES"), categoryIds: z.array(id) }),
    z.object({ mode: z.literal("IDS"), registrationIds: z.array(id) }),
  ]),
  duplex: z.boolean().default(false),
});

export const GET = withStaffAuth(
  async (req) => {
    const eventId = new URL(req.url).searchParams.get("eventId");
    const generations = await prisma.printSheetGeneration.findMany({
      where: eventId ? { eventId } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        event: { select: { id: true, title: true } },
        layout: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ generations });
  },
  { minRole: "STAFF_SUPPORT" },
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
      if (err instanceof GenerationError) {
        return NextResponse.json({ error: err.code, message: err.message }, { status: err.httpStatus });
      }
      throw err;
    }
  },
  { minRole: "STAFF_SUPPORT" },
);
