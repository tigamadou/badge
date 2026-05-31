import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const ALLOWED_DOCUMENT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type UploadKind = "photo" | "document";

export function isAllowedMime(mime: string, kind: UploadKind): boolean {
  if (kind === "photo") return ALLOWED_IMAGE_MIME.has(mime);
  return ALLOWED_DOCUMENT_MIME.has(mime);
}

export function assertWithinSizeLimit(bytes: number): void {
  if (bytes > MAX_UPLOAD_BYTES) {
    throw new Error("TOO_LARGE");
  }
}

function safeFilename(name: string): string {
  if (!name || name.startsWith("/") || name.includes("..") || name.includes("\\")) {
    throw new Error("INVALID_FILENAME");
  }
  // basename uniquement : aucun sous-chemin autorise
  const base = path.basename(name);
  if (!base || base !== name) {
    throw new Error("INVALID_FILENAME");
  }
  return base;
}

export function eventPhotoKey(eventId: string, filename: string): string {
  return `events/${eventId}/photos/${safeFilename(filename)}`;
}

export function eventIdDocumentKey(eventId: string, filename: string): string {
  return `events/${eventId}/idDocuments/${safeFilename(filename)}`;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function uploadFile(
  key: string,
  body: Buffer,
  _contentType: string,
): Promise<string> {
  const filePath = path.join(UPLOADS_DIR, key);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, body);
  return key;
}

export async function getFile(
  key: string,
): Promise<{ body: Buffer; contentType: string }> {
  const filePath = path.join(UPLOADS_DIR, key);
  const body = await fs.readFile(filePath);

  const ext = path.extname(key).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
  };

  return {
    body,
    contentType: mimeTypes[ext] || "application/octet-stream",
  };
}

export async function deleteFile(key: string): Promise<void> {
  const filePath = path.join(UPLOADS_DIR, key);
  try {
    await fs.unlink(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
}
