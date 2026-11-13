import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withOrgAuth } from "@/lib/with-org-auth";
import { prisma } from "@/lib/prisma";
import { uploadFile, isAllowedMime, MAX_UPLOAD_BYTES } from "@/lib/storage";
import {
  EVENT_IMAGE_SELECT,
  getEventImageRequirements,
  rejectionResponse,
  validateImageBuffer,
  type ImageSlot,
} from "@/lib/event-image-compliance";

// v4 Task 5.4 : upload d'images org-scoped (logos d'organisation et d'evenement).
// Images uniquement (JPEG/PNG/WebP). Reserve a la permission `org.upload`.
const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const PURPOSES = new Set(["logo", "banner", "original"]);

// Sans `purpose` : comportement historique (logo d'organisation, images d'options du
// template). `logo` / `banner` : image d'evenement controlee contre le cadre du template ;
// `original` : source de recadrage conservee telle quelle (WebP accepte).
export const POST = withOrgAuth("org.upload", async (req, { orgId }) => {
  const url = new URL(req.url);
  const purpose = url.searchParams.get("purpose");
  if (purpose !== null && !PURPOSES.has(purpose)) {
    return NextResponse.json({ error: "Usage inconnu", code: "BAD_PURPOSE" }, { status: 400 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fichier manquant", code: "NO_FILE" }, { status: 400 });
  }
  const mime = file.type;
  if (!isAllowedMime(mime, "photo")) {
    return NextResponse.json({ error: "Type interdit", code: "BAD_TYPE" }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (5 Mo max)", code: "TOO_LARGE" },
      { status: 413 },
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());

  let dimensions: { width: number; height: number } | null = null;
  if (purpose !== null) {
    let requirement = null;
    if (purpose !== "original") {
      const eventId = url.searchParams.get("eventId");
      const event = eventId
        ? await prisma.event.findFirst({ where: { id: eventId, orgId }, select: EVENT_IMAGE_SELECT })
        : null;
      if (!event) return NextResponse.json({ error: "Introuvable", code: "NOT_FOUND" }, { status: 404 });
      requirement = (await getEventImageRequirements(event))[purpose as ImageSlot] ?? null;
    }
    const verdict = validateImageBuffer(buffer, mime, requirement, { engineFormatsOnly: purpose !== "original" });
    if (!verdict.ok) return rejectionResponse(verdict);
    dimensions = purpose === "original" ? null : { width: verdict.width, height: verdict.height };
  }

  // mime est deja restreint aux cles de EXT par isAllowedMime ci-dessus.
  const storageKey = `orgs/${orgId}/images/${randomUUID()}${EXT[mime]}`;
  await uploadFile(storageKey, buffer, mime);
  return NextResponse.json(dimensions ? { storageKey, ...dimensions } : { storageKey });
});
