import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withEventAuth } from "@/lib/with-event-auth";
import { uploadFile, isAllowedMime, MAX_UPLOAD_BYTES, printRequestFileKey } from "@/lib/storage";

// Plan 33 : fichier joint à une demande d'impression (maquette, logo, PDF). Réservé aux
// détenteurs de `print.request`. Le fil reste ouvert sur un évènement archivé (C11).
const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export const POST = withEventAuth(
  { permission: "print.request", allowArchived: true },
  async (req, { eventId }) => {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier manquant", code: "NO_FILE" }, { status: 400 });
    }
    if (!isAllowedMime(file.type, "document")) {
      return NextResponse.json({ error: "Type interdit", code: "BAD_TYPE" }, { status: 415 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (5 Mo max)", code: "TOO_LARGE" },
        { status: 413 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    // Le type est déjà restreint aux clés de EXT par isAllowedMime.
    const storageKey = printRequestFileKey(eventId, `${randomUUID()}${EXT[file.type]}`);
    await uploadFile(storageKey, buffer, file.type);
    const originalName = file.name;
    return NextResponse.json({ storageKey, originalName, size: buffer.length });
  },
);
