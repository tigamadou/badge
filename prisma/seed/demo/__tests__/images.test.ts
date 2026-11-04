import { describe, it, expect, afterEach } from "vitest";
import { getFile, listPrefix, MAX_UPLOAD_BYTES } from "@/lib/storage";
import { createDemoContext } from "../context";
import { buildImageReserve } from "../images";
import { readImageDimensions } from "@/lib/image-dimensions";
import { encodePng } from "../png";

const PREFIX = "demo/_test-images/";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const newCtx = () => createDemoContext({ env: { BADGE_ENV: "dev" }, scale: 0.02, storagePrefix: PREFIX });

describe("reserve d'images de demo", () => {
  afterEach(async () => {
    await (await newCtx()).storage.clear();
  });

  it("encodePng produit une signature PNG valide", () => {
    const png = encodePng(2, 2, (x, y) => [x * 100, y * 100, 50]);
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
  });

  it("construit 30 photos, 12 logos et 8 bannieres lisibles", async () => {
    const ctx = await newCtx();
    const images = await buildImageReserve(ctx);
    expect(images.photos).toHaveLength(30);
    expect(images.logos).toHaveLength(12);
    expect(images.banners).toHaveLength(8);
    for (const key of [...images.photos, ...images.logos, ...images.banners]) {
      expect(key.startsWith(PREFIX)).toBe(true);
      const file = await getFile(key);
      expect(file.contentType).toBe("image/png");
      expect(file.body.length).toBeGreaterThan(0);
      expect(file.body.length).toBeLessThan(50_000);
      expect(file.body.length).toBeLessThan(MAX_UPLOAD_BYTES);
      expect(file.body.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    }
  });

  it("respecte les dimensions des cadres : photo 210x270, logo 136x136, banniere 1500x500", async () => {
    const images = await buildImageReserve(await newCtx());
    const dims = async (key: string) => {
      const d = readImageDimensions((await getFile(key)).body);
      return d && [d.width, d.height];
    };
    for (const key of images.photos) expect(await dims(key)).toEqual([210, 270]);
    for (const key of images.logos) expect(await dims(key)).toEqual([136, 136]);
    for (const key of images.banners) expect(await dims(key)).toEqual([1500, 500]);
  });

  it("createDemoContext expose la reserve", async () => {
    const ctx = await newCtx();
    expect(ctx.images.photos).toHaveLength(30);
    expect(ctx.images.logos[0]).toBe(`${PREFIX}images/logo-01.png`);
  });

  it("est deterministe pour une meme graine et ne cree pas de doublon", async () => {
    const ctx1 = await newCtx();
    const first = await buildImageReserve(ctx1);
    const bytes1 = (await getFile(first.photos[0])).body;
    const listing1 = await listPrefix(PREFIX);

    const ctx2 = await newCtx();
    const second = await buildImageReserve(ctx2);
    const bytes2 = (await getFile(second.photos[0])).body;
    const listing2 = await listPrefix(PREFIX);

    expect(second).toEqual(first);
    expect(bytes2.equals(bytes1)).toBe(true);
    expect(listing2).toEqual(listing1);
  }, 60_000);
});
