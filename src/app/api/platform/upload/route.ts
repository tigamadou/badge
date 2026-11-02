import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { withStaffAuth } from "@/lib/with-staff-auth";
import { prisma } from "@/lib/prisma";
import { requireStaff, AuthError } from "@/lib/auth-guards";
import { uploadFile, isAllowedMime, MAX_UPLOAD_BYTES, type UploadKind } from "@/lib/storage";

// Plan 32 : televersement plateforme (staff). `print-product` = image du catalogue (STAFF_ADMIN,
// public) ; `print-request` = fichier joint a une commande d'impression (STAFF_SUPPORT, prive),
// range sous `print-requests/staff/{requestId}/` : la cle est liee a la commande (parametre
// `requestId` obligatoire), donc /api/files en deduit l'evenement et le message ne peut pas
// reprendre la cle d'une autre commande.
// Erreurs alignees sur les routes d'upload existantes : 400 / 415 BAD_TYPE / 413 TOO_LARGE.
const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const CONTEXTS: Record<string, { kind: UploadKind; prefix: string; admin: boolean; perRequest?: boolean }> = {
  "print-product": { kind: "photo", prefix: "platform/print-products", admin: true },
  "print-request": { kind: "document", prefix: "print-requests/staff", admin: false, perRequest: true },
};

export const POST = withStaffAuth(
  async (req, { session }) => {
    const params = new URL(req.url).searchParams;
    const name = params.get("context") ?? "";
    const context = Object.hasOwn(CONTEXTS, name) ? CONTEXTS[name] : undefined;
    if (!context) {
      return NextResponse.json({ error: "Contexte invalide", code: "BAD_CONTEXT" }, { status: 400 });
    }
    if (context.admin) {
      try {
        await requireStaff(session.user.id, "STAFF_ADMIN");
      } catch (err) {
        if (err instanceof AuthError) {
          return NextResponse.json({ error: err.code }, { status: err.httpStatus });
        }
        throw err;
      }
    }

    let prefix = context.prefix;
    if (context.perRequest) {
      const requestId = params.get("requestId") ?? "";
      const known = requestId ? await prisma.printRequest.findUnique({ where: { id: requestId }, select: { id: true } }) : null;
      if (!known) {
        return NextResponse.json({ error: "Commande introuvable", code: "BAD_REQUEST_ID" }, { status: 400 });
      }
      prefix = `${prefix}/${known.id}`;
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Fichier manquant", code: "NO_FILE" }, { status: 400 });
    }
    const mime = file.type;
    if (!isAllowedMime(mime, context.kind)) {
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
    const storageKey = `${prefix}/${randomUUID()}${EXT[mime]}`;
    await uploadFile(storageKey, buffer, mime);
    return NextResponse.json({ storageKey });
  },
  { minRole: "STAFF_SUPPORT" },
);
