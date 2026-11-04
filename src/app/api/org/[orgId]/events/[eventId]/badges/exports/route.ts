import { NextResponse } from "next/server";
import { z } from "zod";
import { withEventAuth } from "@/lib/with-event-auth";
import { logActivity } from "@/lib/activity-log";
import { createZipExport, GenerationError } from "@/lib/print-sheets/generations";
import { EventImagesNoncompliantError, eventImagesErrorResponse } from "@/lib/event-image-compliance";
import { exportView } from "./view";

export const runtime = "nodejs";

// Aucun maximum sur les identifiants : le ZIP est produit par le worker, pas par la requête.
const bodySchema = z.object({ ids: z.array(z.string().min(1)) });

// Export ZIP asynchrone pour imprimante à badges. Même garde que le badge seul
// (badge.print, évènement archivé permis).
export const POST = withEventAuth(
  { permission: "badge.print", allowArchived: true },
  async (req, { orgId, eventId, session }) => {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
    }
    try {
      const { generation, reused } = await createZipExport({
        eventId,
        registrationIds: parsed.data.ids,
        userId: session.user.id,
      });
      // Export identique déjà en cours : on le renvoie, sans doublon ni nouvelle entrée de journal.
      if (reused) return NextResponse.json({ export: exportView(generation) });
      await logActivity({
        type: "BADGE_BATCH_EXPORTED",
        userId: session.user.id,
        orgId,
        eventId,
        details: { format: "zip", count: generation.badgeCount, exportId: generation.id },
        req,
      });
      return NextResponse.json({ export: exportView(generation) }, { status: 201 });
    } catch (err) {
      if (err instanceof EventImagesNoncompliantError) return eventImagesErrorResponse(err);
      if (err instanceof GenerationError) {
        return NextResponse.json({ error: err.code, message: err.message }, { status: err.httpStatus });
      }
      throw err;
    }
  },
);
