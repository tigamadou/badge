import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  isAllowedMime,
  assertWithinSizeLimit,
  uploadFile,
  eventPhotoKey,
  eventIdDocumentKey,
  MAX_UPLOAD_BYTES,
  type UploadKind,
} from "@/lib/storage";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

function parseContext(ctx: string | null): { slug: string } | null {
  if (!ctx) return null;
  const m = ctx.match(/^event:(.+)$/);
  return m ? { slug: m[1] } : null;
}

function parseKind(k: string | null): UploadKind | null {
  return k === "photo" || k === "document" ? k : null;
}

function extOf(name: string, fallback: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : fallback;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const ctx = parseContext(url.searchParams.get("context"));
  const kind = parseKind(url.searchParams.get("kind"));
  if (!ctx || !kind) {
    return NextResponse.json({ error: "Bad request", code: "BAD_CONTEXT" }, { status: 400 });
  }

  const ip = extractClientIp(new Headers(req.headers));
  const rl = checkRateLimit(ip, "upload");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes", code: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const event = await prisma.event.findUnique({ where: { slug: ctx.slug } });
  if (!event) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  if (event.archived || !event.registrationOpen) {
    return NextResponse.json({ error: "Inscriptions fermées", code: "CLOSED" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant", code: "NO_FILE" }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedMime(mime, kind)) {
    return NextResponse.json({ error: "Type interdit", code: "BAD_TYPE" }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (5 Mo max)", code: "TOO_LARGE" }, { status: 413 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  assertWithinSizeLimit(buffer.length);

  const origName = file.name;
  const ext = extOf(origName, mime === "application/pdf" ? ".pdf" : ".bin");
  const filename = `${randomUUID()}${ext}`;
  const storageKey = kind === "photo"
    ? eventPhotoKey(event.id, filename)
    : eventIdDocumentKey(event.id, filename);

  await uploadFile(storageKey, buffer, mime);

  // v4 Task 5.3 : contrat unifie avec /api/account/upload -> { storageKey }.
  // L'ancien flux de token HMAC signe (verifyUploadToken) etait mort (jamais consomme).
  return NextResponse.json({ storageKey, originalName: origName, kind, size: buffer.length });
}
