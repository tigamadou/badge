import type { InstalledBadgeTemplate, Prisma } from "@prisma/client";
import { encodePng } from "../../prisma/seed/demo/png";
import { uploadFile } from "@/lib/storage";
import { makeInstalledTemplate } from "./factories";

/** PNG uni aux dimensions voulues (les en-tetes comptent, pas le dessin). */
export function makePng(width: number, height: number): Buffer {
  return encodePng(width, height, () => [200, 120, 40]);
}

/** JPEG minimal (SOI + SOF0 + EOI) : suffisant pour un lecteur d'en-tetes. */
export function makeJpegHeader(width: number, height: number): Buffer {
  const sof = Buffer.alloc(13);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(11, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof[9] = 1;
  sof[10] = 1;
  sof[11] = 0x11;
  sof[12] = 0;
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

/** WebP VP8X minimal (RIFF/WEBP/VP8X) aux dimensions voulues. */
export function makeWebpHeader(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(22, 4);
  buf.write("WEBP", 8, "ascii");
  buf.write("VP8X", 12, "ascii");
  buf.writeUInt32LE(10, 16);
  buf.writeUIntLE(width - 1, 24, 3);
  buf.writeUIntLE(height - 1, 27, 3);
  return buf;
}

/** Ecrit une image dans le stockage de test et rend sa cle. */
export async function putTestImage(key: string, buf: Buffer, contentType: string): Promise<string> {
  return uploadFile(key, buf, contentType);
}

type Frame = { w: number; h: number };

function frameBlock(name: string, source: string, frame: Frame, y: number) {
  return {
    type: "rect",
    name,
    x: 10,
    y,
    w: frame.w,
    h: frame.h,
    fill: "#ffffff",
    image: { source, fit: "cover" },
  };
}

/** Template installe dont les blocs encadrent le logo et/ou la banniere de l'evenement. */
export function makeFramedTemplate(
  installedById: string,
  frames: { logo?: Frame; banner?: Frame; nested?: boolean },
  data: Partial<Prisma.InstalledBadgeTemplateUncheckedCreateInput> & { pages?: 1 | 2 } = {},
): Promise<InstalledBadgeTemplate> {
  const slots = [
    { frame: frames.logo, source: "event.logoDataUrl", label: "Logo", y: 10 },
    { frame: frames.banner, source: "event.bannerDataUrl", label: "Banniere", y: 100 },
  ].filter((s): s is typeof s & { frame: Frame } => s.frame !== undefined);

  const blocks = slots.map((s) => frameBlock(s.label, s.source, s.frame, s.y));
  const variables = slots.map((s) => ({ name: s.source, kind: "image", label: s.label }));
  const bindings = Object.fromEntries(slots.map((s) => [s.source, s.source]));
  const family = `framed-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

  return makeInstalledTemplate(installedById, {
    family,
    assetPrefix: `badge-templates/${family}/`,
    layout: {
      formatVersion: 3,
      family,
      label: "Cadre",
      description: "",
      category: "badge",
      page: { widthPx: 320, heightPx: 460, count: 1 },
      variables,
      blocks: frames.nested
        ? [{ type: "group", x: 0, y: 0, w: 320, h: 460, blocks }]
        : blocks,
    } as Prisma.InputJsonValue,
    bindings,
    ...data,
  });
}
