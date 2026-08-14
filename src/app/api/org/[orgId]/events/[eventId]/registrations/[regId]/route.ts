import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";

type Params = { orgId: string; eventId: string; regId: string };

export const GET = withEventAuth(
  { minRole: "OPERATOR", allowArchived: true },
  async (_req, { eventId }, extra) => {
    const { regId } = (await extra.params) as Params;
    const registration = await prisma.registration.findUnique({
      where: { id: regId },
      include: { category: true },
    });
    if (!registration || registration.eventId !== eventId) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ registration });
  },
);

// v2-11 : l'admin ne modifie plus les champs profil directement -- ils vivent
// sur User et sont snapshotes au moment de l'inscription/resoumission. Le PATCH
// reste utile pour corriger une typo dans le snapshot stocke ou changer la categorie.
const patchSchema = z.object({
  snapshotEmail: z.string().email().optional(),
  snapshotFirstName: z.string().min(1).max(120).optional(),
  snapshotLastName: z.string().min(1).max(120).optional(),
  snapshotStructure: z.string().min(1).max(200).optional(),
  snapshotIdDocumentType: z.string().min(1).max(40).optional(),
  snapshotIdDocumentNumber: z.string().min(1).max(80).optional(),
  snapshotPhoto: z.string().min(1).max(500).optional(),
  snapshotIdDocument: z.string().min(1).max(500).optional(),
  categoryId: z.string().optional(),
  allAccessGranted: z.boolean().optional(),
});

export const PATCH = withEventAuth(
  { minRole: "ADMIN" },
  async (req, { orgId, eventId, session }, extra) => {
    const { regId } = (await extra.params) as Params;
    const json = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 400 });
    }
    const existing = await prisma.registration.findUnique({ where: { id: regId } });
    if (!existing || existing.eventId !== eventId) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    if (parsed.data.categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
      if (!cat || cat.eventId !== eventId) {
        return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
      }
    }

    const updated = await prisma.registration.update({
      where: { id: regId },
      data: parsed.data,
    });

    await logActivity({
      type: "REGISTRATION_UPDATED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: regId,
      details: { changedFields: Object.keys(parsed.data) },
      req,
    });

    return NextResponse.json({ registration: updated });
  },
);

export const DELETE = withEventAuth(
  { minRole: "ADMIN" },
  async (req, { orgId, eventId, session }, extra) => {
    const { regId } = (await extra.params) as Params;
    const existing = await prisma.registration.findUnique({ where: { id: regId } });
    if (!existing || existing.eventId !== eventId) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    await prisma.registration.delete({ where: { id: regId } });
    await logActivity({
      type: "REGISTRATION_DELETED",
      userId: session.user.id,
      orgId,
      eventId,
      targetId: regId,
      details: { email: existing.snapshotEmail },
      req,
    });
    return new NextResponse(null, { status: 204 });
  },
);
