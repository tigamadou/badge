import path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

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

export function accountProfileKey(userId: string, kind: UploadKind, filename: string): string {
  return `profile/${userId}/${kind === "photo" ? "photos" : "documents"}/${safeFilename(filename)}`;
}

// v4 : stockage objet S3-compatible (MinIO en dev). L'API publique (uploadFile/getFile/
// deleteFile) est inchangee ; deletePrefix est ajoute pour l'archivage par prefixe.
const BUCKET = process.env.S3_BUCKET ?? "badge-dev";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true, // requis pour MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "minioadmin",
  },
});

let bucketReady: Promise<void> | null = null;
async function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
      } catch {
        /* v8 ignore next -- creation de bucket : exercee seulement sur un bucket absent (CI MinIO vierge) */
        await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
      }
    })();
  }
  return bucketReady;
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
  return key;
}

export async function getFile(
  key: string,
): Promise<{ body: Buffer; contentType: string }> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return {
    body: Buffer.from(bytes),
    /* v8 ignore next -- MinIO renvoie toujours un ContentType ; fallback defensif */
    contentType: res.ContentType ?? "application/octet-stream",
  };
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// Archivage par prefixe (ex. orgs/{orgId}/). Retourne le nombre d'objets supprimes.
export async function deletePrefix(prefix: string): Promise<number> {
  await ensureBucket();
  let deleted = 0;
  let token: string | undefined;
  do {
    const list = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }),
    );
    const objects = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: objects } }));
      deleted += objects.length;
    }
    /* v8 ignore next -- branche IsTruncated=true : exige >1000 objets sous un prefixe (impraticable en unitaire) */
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}
