import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import {
  isAllowedMime,
  assertWithinSizeLimit,
  uploadFile,
  accountProfileKey,
  MAX_UPLOAD_BYTES,
  type UploadKind,
} from "@/lib/storage";
import { requireAuth, AuthError } from "@/lib/auth-participant";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

function parseKind(k: string | null): UploadKind | null {
  return k === "photo" || k === "document" ? k : null;
}

function extOf(name: string, fallback: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const ip = extractClientIp(req.headers);
    const rl = checkRateLimit(ip, "account-upload", { windowMs: 60_000, max: 20 });
    if (!rl.ok) {
      return NextResponse.json(
        { code: "RATE_LIMITED", error: "Trop de requêtes." },
        { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    const url = new URL(req.url);
    const kind = parseKind(url.searchParams.get("kind"));
    if (!kind) {
      return NextResponse.json({ code: "BAD_KIND", error: "kind requis (photo|document)." }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ code: "NO_FILE", error: "Fichier manquant." }, { status: 400 });
    }

    const mime = file.type || "application/octet-stream";
    if (!isAllowedMime(mime, kind)) {
      return NextResponse.json({ code: "BAD_TYPE", error: "Type de fichier non autorisé." }, { status: 415 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { code: "TOO_LARGE", error: "Fichier trop volumineux (5 Mo max)." },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    assertWithinSizeLimit(buffer.length);

    const origName = file instanceof File ? file.name : "upload";
    const ext = extOf(origName, mime === "application/pdf" ? ".pdf" : ".bin");
    const filename = `${randomUUID()}${ext}`;
    const storageKey = accountProfileKey(session.id, kind, filename);

    await uploadFile(storageKey, buffer, mime);

    return NextResponse.json({ storageKey, originalName: origName, kind, size: buffer.length });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ code: err.code, error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
