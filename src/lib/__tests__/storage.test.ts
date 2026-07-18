import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import {
  eventPhotoKey,
  eventIdDocumentKey,
  accountProfileKey,
  uploadFile,
  getFile,
  deleteFile,
  deletePrefix,
  ALLOWED_IMAGE_MIME,
  ALLOWED_DOCUMENT_MIME,
  MAX_UPLOAD_BYTES,
  isAllowedMime,
  assertWithinSizeLimit,
} from "@/lib/storage";

const UPLOADS = path.join(process.cwd(), "uploads");

afterEach(async () => {
  // best-effort cleanup
  await fs.rm(path.join(UPLOADS, "events", "evt-test"), { recursive: true, force: true });
});

describe("storage path helpers", () => {
  it("eventPhotoKey returns events/<eventId>/photos/<filename>", () => {
    const k = eventPhotoKey("evt-test", "abc.jpg");
    expect(k).toBe("events/evt-test/photos/abc.jpg");
  });

  it("eventIdDocumentKey returns events/<eventId>/idDocuments/<filename>", () => {
    const k = eventIdDocumentKey("evt-test", "doc.pdf");
    expect(k).toBe("events/evt-test/idDocuments/doc.pdf");
  });

  it("accountProfileKey uses photos/ for photo kind and documents/ for document kind", () => {
    expect(accountProfileKey("user-1", "photo", "p.jpg")).toBe(
      "profile/user-1/photos/p.jpg",
    );
    expect(accountProfileKey("user-1", "document", "d.pdf")).toBe(
      "profile/user-1/documents/d.pdf",
    );
  });

  it("uploadFile creates the directory and writes the file", async () => {
    const key = eventPhotoKey("evt-test", "x.png");
    await uploadFile(key, Buffer.from("hello"), "image/png");
    const r = await getFile(key);
    expect(r.body.toString()).toBe("hello");
    expect(r.contentType).toBe("image/png");
  });

  it("deleteFile removes the file (no-op if missing)", async () => {
    const key = eventPhotoKey("evt-test", "y.png");
    await uploadFile(key, Buffer.from("y"), "image/png");
    await deleteFile(key);
    await expect(getFile(key)).rejects.toThrow();
    await expect(deleteFile(key)).resolves.toBeUndefined();
  });
});

describe("mime + size validation", () => {
  it("accepts JPEG/PNG/WebP for photos", () => {
    expect(isAllowedMime("image/jpeg", "photo")).toBe(true);
    expect(isAllowedMime("image/png", "photo")).toBe(true);
    expect(isAllowedMime("image/webp", "photo")).toBe(true);
  });
  it("rejects PDF for photos", () => {
    expect(isAllowedMime("application/pdf", "photo")).toBe(false);
  });
  it("accepts JPEG/PNG/WebP/PDF for documents", () => {
    for (const m of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      expect(isAllowedMime(m, "document")).toBe(true);
    }
  });
  it("rejects unknown types", () => {
    expect(isAllowedMime("text/plain", "photo")).toBe(false);
    expect(isAllowedMime("application/zip", "document")).toBe(false);
  });
  it("assertWithinSizeLimit throws for files larger than 5 MB", () => {
    expect(() => assertWithinSizeLimit(MAX_UPLOAD_BYTES + 1)).toThrow(/TOO_LARGE/);
  });
  it("assertWithinSizeLimit passes at limit", () => {
    expect(() => assertWithinSizeLimit(MAX_UPLOAD_BYTES)).not.toThrow();
  });
  it("exposes ALLOWED_IMAGE_MIME and ALLOWED_DOCUMENT_MIME sets", () => {
    expect(ALLOWED_IMAGE_MIME.size).toBe(3);
    expect(ALLOWED_DOCUMENT_MIME.has("application/pdf")).toBe(true);
  });
});

describe("path safety", () => {
  it("rejects path traversal in filename", () => {
    expect(() => eventPhotoKey("evt-test", "../../etc/passwd")).toThrow();
    expect(() => eventIdDocumentKey("evt-test", "..\\evil")).toThrow();
  });
  it("rejects empty / absolute filenames", () => {
    expect(() => eventPhotoKey("evt-test", "")).toThrow();
    expect(() => eventPhotoKey("evt-test", "/abs")).toThrow();
  });

  // Couvre la garde `base !== name` (storage.ts:47-49) : un nom contenant un
  // sous-chemin sans "..", "\\" ni prefixe "/" passe la premiere garde mais
  // echoue car basename() != name.
  it("rejects filenames that contain a subdirectory", () => {
    expect(() => eventPhotoKey("evt-test", "sub/file.jpg")).toThrow(/INVALID_FILENAME/);
    expect(() => eventIdDocumentKey("evt-test", "a/b.pdf")).toThrow(/INVALID_FILENAME/);
  });
});

describe("deletePrefix", () => {
  it("deletes every object under a prefix and returns the count", async () => {
    const evt = "evt-del";
    await uploadFile(eventPhotoKey(evt, "a.png"), Buffer.from("a"), "image/png");
    await uploadFile(eventPhotoKey(evt, "b.png"), Buffer.from("b"), "image/png");

    const deleted = await deletePrefix(`events/${evt}/`);
    expect(deleted).toBe(2);

    await expect(getFile(eventPhotoKey(evt, "a.png"))).rejects.toThrow();
    await expect(getFile(eventPhotoKey(evt, "b.png"))).rejects.toThrow();
  });

  it("returns 0 when no object matches the prefix", async () => {
    const deleted = await deletePrefix("events/evt-none-xyz-123/");
    expect(deleted).toBe(0);
  });
});
