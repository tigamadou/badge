import type { DemoContext } from "./context";
import { encodePng } from "./png";

type Kind = { name: string; count: number; width: number; height: number };

// Dimensions conformes aux cadres des templates livres (voir images-badge) : photo d'identite 7:9
// (210 x 270 px minimum), logo 1:1 de 2 x 68 px (cadre de `recto-verso`), banniere 3:1 de 1500 x 500 px.
const KINDS: Record<"photos" | "logos" | "banners", Kind> = {
  photos: { name: "photo", count: 30, width: 210, height: 270 },
  logos: { name: "logo", count: 12, width: 136, height: 136 },
  banners: { name: "banner", count: 8, width: 1500, height: 500 },
};

// Cellule proportionnelle a la petite dimension : les grandes images restent legeres a compresser.
const cellSize = (width: number, height: number) => Math.max(8, Math.round(Math.min(width, height) / 8));
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Degrade diagonal quantifie par cellules, avec un disque central : leger a compresser et deterministe. */
function paint(ctx: Pick<DemoContext, "faker">, width: number, height: number) {
  const { faker } = ctx;
  const from = [faker.number.int({ max: 255 }), faker.number.int({ max: 255 }), faker.number.int({ max: 255 })];
  const to = [faker.number.int({ max: 255 }), faker.number.int({ max: 255 }), faker.number.int({ max: 255 })];
  const accent = [faker.number.int({ max: 255 }), faker.number.int({ max: 255 }), faker.number.int({ max: 255 })];
  const radius = Math.min(width, height) / 4;
  const cell = cellSize(width, height);
  return (x: number, y: number): [number, number, number] => {
    const cx = Math.floor(x / cell) * cell + cell / 2;
    const cy = Math.floor(y / cell) * cell + cell / 2;
    if (Math.hypot(cx - width / 2, cy - height / 2) < radius) {
      return [clamp(accent[0]), clamp(accent[1]), clamp(accent[2])];
    }
    const t = (cx + cy) / (width + height);
    return [0, 1, 2].map((i) => clamp(from[i] + (to[i] - from[i]) * t)) as [number, number, number];
  };
}

/** Ecrit la reserve d'images partagee (sequentiellement) sous `<prefixe>images/` ; reecrit les memes cles. */
export async function buildImageReserve(
  ctx: Pick<DemoContext, "faker" | "storage">,
): Promise<DemoContext["images"]> {
  const images: DemoContext["images"] = { photos: [], logos: [], banners: [] };
  for (const group of Object.keys(KINDS) as Array<keyof typeof KINDS>) {
    const { name, count, width, height } = KINDS[group];
    for (let i = 1; i <= count; i++) {
      const png = encodePng(width, height, paint(ctx, width, height));
      const key = ctx.storage.key("images", `${name}-${String(i).padStart(2, "0")}.png`);
      images[group].push(await ctx.storage.put(key, png, "image/png"));
    }
  }
  return images;
}
