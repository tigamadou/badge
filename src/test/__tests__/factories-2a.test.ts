import { describe, expect, it } from "vitest";
import { readImageDimensions } from "@/lib/image-dimensions";
import { makeFramedTemplate, makeJpegHeader, makePng, makeWebpHeader } from "../factories-2a";
import { makeStaff, seedFactories } from "../factories";

seedFactories(2201);

describe("fabriques d'images du lot 2a", () => {
  it("fabrique un PNG, un JPEG et un WebP aux dimensions demandees", () => {
    expect(readImageDimensions(makePng(420, 540))).toEqual({ width: 420, height: 540, format: "png" });
    expect(readImageDimensions(makeJpegHeader(300, 100))).toEqual({ width: 300, height: 100, format: "jpeg" });
    expect(readImageDimensions(makeWebpHeader(64, 32))).toEqual({ width: 64, height: 32, format: "webp" });
  });

  it("cadre le logo directement ou dans un groupe", async () => {
    const staff = await makeStaff("SUPER_ADMIN");
    const flat = await makeFramedTemplate(staff.id, { logo: { w: 68, h: 68 }, banner: { w: 750, h: 250 } });
    const layout = flat.layout as { blocks: { image: { source: string }; w: number }[] };
    expect(layout.blocks[0].image.source).toBe("event.logoDataUrl");
    expect(layout.blocks[1].w).toBe(750);
    expect(flat.bindings).toEqual({ "event.logoDataUrl": "event.logoDataUrl", "event.bannerDataUrl": "event.bannerDataUrl" });

    const nested = await makeFramedTemplate(staff.id, { logo: { w: 68, h: 68 }, nested: true });
    const nestedLayout = nested.layout as { blocks: { type: string; blocks: { image: { source: string } }[] }[] };
    expect(nestedLayout.blocks[0].type).toBe("group");
    expect(nestedLayout.blocks[0].blocks[0].image.source).toBe("event.logoDataUrl");
  });
});
