import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withEventAuth } from "@/lib/with-event-auth";
import {
  uploadFile,
  isAllowedMime,
  MAX_UPLOAD_BYTES,
  eventPhotoKey,
  eventIdDocumentKey,
} from "@/lib/storage";

// v4 Task 5.4 : upload photo/piece d'identite lors d'une inscription creee par un
// admin d'evenement. Fonctionne meme si les inscriptions publiques sont fermees
// (requireRegistrationOpen non demande). Reserve au role ADMIN de l'evenement.
const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export const POST = withEventAuth({ minRole: "ADMIN" }, async (req, { eventId }) => {
  const kind = new URL(req.url).searchParams.get("kind");
  if (kind !== "photo" && kind !== "document") {
    return NextResponse.json({ error: "Type de fichier invalide", code: "BAD_KIND" }, { status: 400 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Fichier manquant", code: "NO_FILE" }, { status: 400 });
  }
  const mime = file.type;
  if (!isAllowedMime(mime, kind)) {
    return NextResponse.json({ error: "Type interdit", code: "BAD_TYPE" }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (5 Mo max)", code: "TOO_LARGE" },
      { status: 413 },
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}${EXT[mime] ?? ""}`;
  const storageKey =
    kind === "photo" ? eventPhotoKey(eventId, filename) : eventIdDocumentKey(eventId, filename);
  await uploadFile(storageKey, buffer, mime);
  return NextResponse.json({ storageKey });
});
