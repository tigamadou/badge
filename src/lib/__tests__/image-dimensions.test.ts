import { describe, it, expect } from "vitest";
import { readImageDimensions, ratioMatches, ID_PHOTO_RATIO } from "@/lib/image-dimensions";

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function u32be(n: number) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}
function u16be(n: number) {
  return [(n >>> 8) & 255, n & 255];
}
function u16le(n: number) {
  return [n & 255, (n >>> 8) & 255];
}
function u24le(n: number) {
  return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];
}
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function png(w: number, h: number) {
  return Buffer.from([...PNG_SIG, ...u32be(13), ...ascii("IHDR"), ...u32be(w), ...u32be(h), 8, 6, 0, 0, 0]);
}
function jpeg(w: number, h: number, sof = 0xc0) {
  const app0 = [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00];
  return Buffer.from([0xff, 0xd8, ...app0, 0xff, sof, 0x00, 0x0b, 0x08, ...u16be(h), ...u16be(w), 0x01, 0x01, 0x11, 0x00]);
}
function riff(chunk: string, body: number[]) {
  return Buffer.from([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), ...ascii(chunk), 0, 0, 0, 0, ...body]);
}
function webpVp8(w: number, h: number) {
  // octets 20-25 : tag de frame + start code, 26/28 : dimensions
  return riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...u16le(w), ...u16le(h)]);
}
function webpVp8l(w: number, h: number) {
  const v = (w - 1) | ((h - 1) << 14);
  return riff("VP8L", [0x2f, v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
}
function webpVp8x(w: number, h: number) {
  return riff("VP8X", [0, 0, 0, 0, ...u24le(w - 1), ...u24le(h - 1)]);
}

describe("readImageDimensions", () => {
  it("lit un PNG", () => {
    expect(readImageDimensions(png(1500, 500))).toEqual({ width: 1500, height: 500, format: "png" });
  });

  it("lit un JPEG en sautant les segments avant SOF", () => {
    expect(readImageDimensions(jpeg(700, 900))).toEqual({ width: 700, height: 900, format: "jpeg" });
    expect(readImageDimensions(jpeg(640, 480, 0xc2))).toEqual({ width: 640, height: 480, format: "jpeg" });
  });

  it("saute les octets de bourrage FF avant un marqueur", () => {
    const base = jpeg(300, 200);
    const buf = Buffer.concat([base.subarray(0, 2), Buffer.from([0xff, 0xff]), base.subarray(2)]);
    expect(readImageDimensions(buf)).toEqual({ width: 300, height: 200, format: "jpeg" });
  });

  it("donne les bonnes dimensions WebP", () => {
    expect(readImageDimensions(webpVp8(320, 240))).toEqual({ width: 320, height: 240, format: "webp" });
    expect(readImageDimensions(webpVp8l(321, 241))).toEqual({ width: 321, height: 241, format: "webp" });
    expect(readImageDimensions(webpVp8x(1500, 500))).toEqual({ width: 1500, height: 500, format: "webp" });
  });

  it.each([
    ["buffer vide", Buffer.alloc(0)],
    ["3 octets", Buffer.from([0x89, 0x50, 0x4e])],
    ["PNG tronque avant IHDR", Buffer.from([...PNG_SIG, 0, 0, 0, 13])],
    ["PNG sans chunk IHDR", Buffer.from([...PNG_SIG, ...u32be(13), ...ascii("IDAT"), ...u32be(1), ...u32be(1)])],
    ["JPEG sans SOF", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00])],
    ["JPEG SOI seul", Buffer.from([0xff, 0xd8])],
    ["JPEG segment trop long", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff, 0x00])],
    ["JPEG longueur de segment absente", Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ["JPEG marqueur sans FF", Buffer.from([0xff, 0xd8, 0x00, 0xe0, 0x00, 0x04, 0x00, 0x00])],
    ["JPEG SOF tronque", Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00])],
    ["JPEG dimension 0", jpeg(0, 100)],
    ["PNG dimension 0", png(0, 100)],
    ["WebP chunk inconnu", riff("ABCD", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    ["WebP VP8 tronque", riff("VP8 ", [0, 0, 0, 0x9d])],
    ["WebP VP8L tronque", riff("VP8L", [0x2f, 0])],
    ["WebP VP8L sans signature", riff("VP8L", [0x00, 0, 0, 0, 0])],
    ["WebP VP8X tronque", riff("VP8X", [0, 0, 0, 0, 1])],
    ["WebP VP8 dimension 0", webpVp8(0, 10)],
    ["texte PDF", Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj")],
    ["RIFF non WEBP", Buffer.from([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE"), 0, 0, 0, 0, 0, 0, 0, 0])],
    ["RIFF trop court", Buffer.from([...ascii("RIFF"), 0, 0, 0, 0])],
  ])("renvoie null pour %s", (_n, buf) => {
    expect(readImageDimensions(buf)).toBeNull();
  });
});

describe("readImageDimensions robustesse", () => {
  it("ne leve jamais d'exception sur une entree invalide", () => {
    expect(readImageDimensions(null as unknown as Buffer)).toBeNull();
  });
});

describe("ratioMatches", () => {
  it("accepte le ratio exact et dans la tolerance", () => {
    expect(ratioMatches(1500, 500, 3, 1)).toBe(true);
    expect(ratioMatches(1500, 510, 3, 1)).toBe(true);
  });
  it("refuse hors tolerance, accepte avec tolerance explicite", () => {
    expect(ratioMatches(1500, 540, 3, 1)).toBe(false);
    expect(ratioMatches(1500, 540, 3, 1, 0.1)).toBe(true);
  });
  it("refuse les valeurs degenerees", () => {
    expect(ratioMatches(0, 500, 3, 1)).toBe(false);
    expect(ratioMatches(1500, 0, 3, 1)).toBe(false);
    expect(ratioMatches(1500, 500, 0, 1)).toBe(false);
    expect(ratioMatches(1500, 500, 3, -1)).toBe(false);
    expect(ratioMatches(NaN, 500, 3, 1)).toBe(false);
  });
  it("ratio photo d'identite", () => {
    expect(ID_PHOTO_RATIO).toEqual({ width: 7, height: 9 });
    expect(ratioMatches(700, 900, ID_PHOTO_RATIO.width, ID_PHOTO_RATIO.height)).toBe(true);
  });
});
