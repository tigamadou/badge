import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withOrgAuth } from "@/lib/with-org-auth";
import { uploadFile, isAllowedMime, MAX_UPLOAD_BYTES } from "@/lib/storage";

// v4 Task 5.4 : upload d'images org-scoped (logos d'organisation et d'evenement).
// Images uniquement (JPEG/PNG/WebP). Reserve aux membres MANAGER+ de l'org.
const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const POST = withOrgAuth("MANAGER", async (req, { orgId }) => {
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
  // mime est deja restreint aux cles de EXT par isAllowedMime ci-dessus.
  const storageKey = `orgs/${orgId}/images/${randomUUID()}${EXT[mime]}`;
  await uploadFile(storageKey, buffer, mime);
  return NextResponse.json({ storageKey });
});
