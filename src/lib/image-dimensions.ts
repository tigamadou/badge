// Lecture des dimensions d'une image a partir de son en-tete (PNG, JPEG, WebP), sans dependance.
// Toute donnee tronquee ou inconnue renvoie null, jamais d'exception.

export type ImageDimensions = { width: number; height: number; format: "jpeg" | "png" | "webp" };

export const ID_PHOTO_RATIO = { width: 7, height: 9 };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function tag(buf: Buffer, offset: number, text: string): boolean {
  return buf.length >= offset + text.length && buf.toString("latin1", offset, offset + text.length) === text;
}

function result(width: number, height: number, format: ImageDimensions["format"]): ImageDimensions | null {
  return width > 0 && height > 0 ? { width, height, format } : null;
}

function readPng(buf: Buffer): ImageDimensions | null {
  if (buf.length < 24 || !tag(buf, 12, "IHDR")) return null;
  return result(buf.readUInt32BE(16), buf.readUInt32BE(20), "png");
}

function readJpeg(buf: Buffer): ImageDimensions | null {
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) return null;
    // octets de bourrage FF repetes avant le marqueur
    while (buf[offset] === 0xff && offset < buf.length - 1) offset++;
    const marker = buf[offset];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (buf.length < offset + 8) return null;
      return result(buf.readUInt16BE(offset + 6), buf.readUInt16BE(offset + 4), "jpeg");
    }
    if (buf.length < offset + 3) return null;
    offset += 1 + buf.readUInt16BE(offset + 1);
  }
  return null;
}

function readWebp(buf: Buffer): ImageDimensions | null {
  if (tag(buf, 12, "VP8 ")) {
    if (buf.length < 30) return null;
    return result(buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff, "webp");
  }
  if (tag(buf, 12, "VP8L")) {
    if (buf.length < 25 || buf[20] !== 0x2f) return null;
    const b0 = buf[21];
    const b1 = buf[22];
    const b2 = buf[23];
    const b3 = buf[24];
    const width = 1 + (b0 | ((b1 & 0x3f) << 8));
    const height = 1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10));
    return result(width, height, "webp");
  }
  if (tag(buf, 12, "VP8X")) {
    if (buf.length < 30) return null;
    return result(1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3), "webp");
  }
  return null;
}

export function readImageDimensions(buf: Buffer): ImageDimensions | null {
  try {
    if (buf.length >= 8 && PNG_SIGNATURE.every((b, i) => buf[i] === b)) return readPng(buf);
    if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) return readJpeg(buf);
    if (tag(buf, 0, "RIFF") && tag(buf, 8, "WEBP")) return readWebp(buf);
    return null;
  } catch {
    return null;
  }
}

export function ratioMatches(
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number,
  tolerance = 0.02,
): boolean {
  if (![width, height, targetWidth, targetHeight].every((n) => Number.isFinite(n) && n > 0)) return false;
  const target = targetWidth / targetHeight;
  return Math.abs(width / height - target) / target <= tolerance;
}
