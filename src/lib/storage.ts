import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function uploadFile(
  key: string,
  body: Buffer,
  _contentType: string
): Promise<string> {
  const filePath = path.join(UPLOADS_DIR, key);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, body);
  return key;
}

export async function getFile(key: string): Promise<{ body: Buffer; contentType: string }> {
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
