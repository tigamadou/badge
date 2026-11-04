import { describe, expect, it } from "vitest";
import type { Block } from "@tigamadou/pdf-engine";
import {
  ID_PHOTO_REQUIREMENT,
  checkAgainst,
  computeCropOutput,
  cropEncodingAttempts,
  MAX_CROP_BYTES,
  findImageFrames,
  frameForSource,
  requirementFromFrame,
  simplifyRatio,
} from "../image-frames";

const shape = (type: "rect" | "square" | "circle" | "ellipse", w: number, h: number, source?: string): Block =>
  ({ type, x: 0, y: 0, w, h, ...(source ? { image: { source } } : {}) }) as Block;
const group = (...blocks: Block[]): Block => ({ type: "group", x: 0, y: 0, w: 300, h: 300, blocks }) as Block;
const text = { type: "text", x: 0, y: 0, w: 10, h: 10, text: "x", style: { sizePx: 10, color: "#000", overflow: "clip" } } as Block;
const list = {
  type: "list", x: 0, y: 0, w: 10, h: 10, source: "logo",
  bullet: { type: "disc", sizePx: 1, color: "#000", gapPx: 1 },
  items: { maxItems: 1, maxChars: 1, maxLines: 1, lineHeightPx: 1 },
  style: { sizePx: 10, color: "#000" },
} as Block;

describe("findImageFrames", () => {
  it("trouve le cadre d'un bloc a image", () => {
    expect(findImageFrames([shape("rect", 68, 68, "logo")], "logo")).toEqual([{ width: 68, height: 68 }]);
  });

  it("parcourt les groupes imbriques", () => {
    const nested = [group(group(shape("rect", 40, 20, "logo")))];
    expect(findImageFrames(nested, "logo")).toEqual([{ width: 40, height: 20 }]);
  });

  it("lit aussi les formes carrees, rondes et ellipses", () => {
    const blocks = [shape("square", 50, 50, "logo"), shape("circle", 30, 30, "logo"), shape("ellipse", 20, 10, "logo")];
    expect(findImageFrames(blocks, "logo")).toHaveLength(3);
  });

  it("ignore texte, liste, bloc sans image et autre source", () => {
    const blocks = [text, list, shape("rect", 10, 10), shape("rect", 10, 10, "banner")];
    expect(findImageFrames(blocks, "logo")).toEqual([]);
  });

  it("conserve l'ordre de document", () => {
    const blocks = [shape("rect", 10, 20, "logo"), group(shape("rect", 30, 40, "logo"))];
    expect(findImageFrames(blocks, "logo")).toEqual([
      { width: 10, height: 20 },
      { width: 30, height: 40 },
    ]);
  });
});

describe("frameForSource", () => {
  const blocks = [shape("rect", 10, 10, "a"), shape("rect", 68, 34, "logo"), shape("rect", 99, 99, "b")];

  it("cherche par liaison et non par nom", () => {
    const frame = frameForSource({ blocks }, [{ name: "logo" }], { logo: "event.logoDataUrl" }, "event.logoDataUrl");
    expect(frame).toEqual({ width: 68, height: 34 });
  });

  it("prend le premier bloc en ordre de document pour deux variables liees", () => {
    const frame = frameForSource(
      { blocks },
      [{ name: "b" }, { name: "logo" }],
      { b: "event.logoDataUrl", logo: "event.logoDataUrl" },
      "event.logoDataUrl",
    );
    expect(frame).toEqual({ width: 68, height: 34 });
  });

  it("rend null sans liaison, sans bloc, ou avec une liaison null / option", () => {
    expect(frameForSource({ blocks }, [{ name: "logo" }], {}, "event.logoDataUrl")).toBeNull();
    expect(frameForSource({ blocks: [] }, [{ name: "logo" }], { logo: "event.logoDataUrl" }, "event.logoDataUrl")).toBeNull();
    expect(frameForSource({ blocks }, [{ name: "logo" }], { logo: null }, "event.logoDataUrl")).toBeNull();
    expect(frameForSource({ blocks }, [{ name: "logo" }], { logo: "option" }, "event.logoDataUrl")).toBeNull();
  });
});

describe("requirementFromFrame / simplifyRatio", () => {
  it("formule l'exigence d'un cadre 3:1", () => {
    expect(requirementFromFrame({ width: 750, height: 250 })).toMatchObject({
      ratioLabel: "3:1", minWidth: 1500, minHeight: 500, exampleWidth: 1500, exampleHeight: 500,
    });
  });

  it("formule les exigences de cadres carres, 5:7 et fractionnaires", () => {
    expect(requirementFromFrame({ width: 68, height: 68 })).toMatchObject({ ratioLabel: "1:1", minWidth: 136, minHeight: 136 });
    expect(requirementFromFrame({ width: 106, height: 150 }).ratioLabel).toBe("5:7");
    expect(requirementFromFrame({ width: 279.69, height: 396.85 })).toMatchObject({ ratioLabel: "5:7", minWidth: 560, minHeight: 794 });
  });

  it("retombe sur les dimensions arrondies quand aucun ratio simple ne convient", () => {
    expect(simplifyRatio(1021, 1000)).toEqual([1021, 1000]);
  });
});

describe("checkAgainst", () => {
  const banner = requirementFromFrame({ width: 750, height: 250 });

  it("accepte le ratio exact et la tolerance", () => {
    expect(checkAgainst({ width: 1500, height: 500 }, banner)).toEqual({ ok: true });
    expect(checkAgainst({ width: 1520, height: 500 }, banner)).toEqual({ ok: true });
  });

  it("refuse hors tolerance", () => {
    expect(checkAgainst({ width: 1530, height: 500 }, banner)).toMatchObject({ ok: false, reason: "RATIO" });
    expect(checkAgainst({ width: 1600, height: 500 }, banner)).toEqual({
      ok: false, reason: "RATIO", message: "Ratio attendu 3:1, par ex. 1500 × 500 px.",
    });
  });

  it("refuse une image trop petite", () => {
    expect(checkAgainst({ width: 300, height: 100 }, banner)).toEqual({
      ok: false, reason: "RESOLUTION",
      message: "Image trop petite : 1500 × 500 px minimum (reçue : 300 × 100 px).",
    });
  });

  it("controle la photo d'identite", () => {
    expect(checkAgainst({ width: 420, height: 540 }, ID_PHOTO_REQUIREMENT)).toEqual({ ok: true });
    expect(checkAgainst({ width: 540, height: 540 }, ID_PHOTO_REQUIREMENT)).toEqual({
      ok: false, reason: "RATIO", message: "Ratio attendu 7:9, par ex. 210 × 270 px.",
    });
    expect(checkAgainst({ width: 140, height: 180 }, ID_PHOTO_REQUIREMENT)).toMatchObject({ ok: false, reason: "RESOLUTION" });
  });
});

describe("computeCropOutput", () => {
  const banner = requirementFromFrame({ width: 750, height: 250 });

  it("plafonne a 3x le minimum et plancher au minimum", () => {
    expect(computeCropOutput({ width: 5000, height: 1666 }, banner)).toEqual({ width: 4500, height: 1500 });
    expect(computeCropOutput({ width: 800, height: 266 }, banner)).toEqual({ width: 1500, height: 500 });
    expect(computeCropOutput({ width: 2000, height: 666 }, banner)).toEqual({ width: 2000, height: 667 });
  });
});

describe("cropEncodingAttempts", () => {
  const banner = requirementFromFrame({ width: 750, height: 250 });
  const out = { width: 4500, height: 1500 };

  it("commence par le format demande, puis replie en JPEG a fond blanc jusqu'au minimum du cadre", () => {
    const png = cropEncodingAttempts(out, banner, "image/png");
    expect(png[0]).toEqual({ mime: "image/png", quality: 0.92, ...out, flatten: false });
    expect(png.slice(1).every((a) => a.mime === "image/jpeg" && a.flatten)).toBe(true);
    const last = png[png.length - 1];
    expect({ width: last.width, height: last.height }).toEqual({ width: banner.minWidth, height: banner.minHeight });
    expect(cropEncodingAttempts(out, banner, "image/jpeg")[0].flatten).toBe(true);
    expect(MAX_CROP_BYTES).toBe(5 * 1024 * 1024);
  });
});
