import { describe, expect, it } from "vitest";
import { px } from "../px";

describe("px", () => {
  it("convertit 300 px (1 pouce a 300 dpi) en 72 points PDF", () => {
    expect(px(300)).toBeCloseTo(72, 10);
  });

  it("convertit 1 px en 0,24 point", () => {
    expect(px(1)).toBeCloseTo(0.24, 10);
  });

  it("laisse zero inchange", () => {
    expect(px(0)).toBe(0);
  });

  it("donne une page CR80 de 1011 px de large au format physique attendu (242,64 pt)", () => {
    expect(px(1011)).toBeCloseTo(242.64, 10);
  });
});
