import { describe, expect, it } from "vitest";
import { px } from "../px";

describe("px", () => {
  it("convertit 96 px (1 pouce a 96 dpi) en 72 points PDF", () => {
    expect(px(96)).toBeCloseTo(72, 10);
  });

  it("convertit 1 px en 0,75 point", () => {
    expect(px(1)).toBeCloseTo(0.75, 10);
  });

  it("laisse zero inchange", () => {
    expect(px(0)).toBe(0);
  });

  it("donne au badge Figma de 317,48 px de large son format physique de 84 mm (238,11 pt)", () => {
    expect(px(317.48)).toBeCloseTo(238.11, 10);
  });
});
