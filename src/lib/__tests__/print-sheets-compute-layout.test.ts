import { describe, it, expect } from "vitest";
import { computeSheetLayout, BadgeTooLargeError, type LayoutSpec } from "@/lib/print-sheets/compute-layout";
import { tenthsToMm, mmToTenths, pxToMm, mmToPt } from "@/lib/print-sheets/units";

const A3: LayoutSpec = {
  sheetWidthMm: 297,
  sheetHeightMm: 420,
  sheetOrientation: "PORTRAIT",
  marginsMm: { top: 10, right: 10, bottom: 10, left: 10 },
  gapHorizontalMm: 5,
  gapVerticalMm: 5,
  badgeOrientation: "AUTO",
  duplexFlip: "LONG_EDGE",
  cropMarks: true,
};

describe("units", () => {
  it("convertit les dixiemes de mm, les pixels CSS et les points", () => {
    expect(tenthsToMm(845)).toBe(84.5);
    expect(mmToTenths(84.54)).toBe(845);
    expect(pxToMm(96)).toBeCloseTo(25.4, 6);
    expect(mmToPt(25.4)).toBeCloseTo(72, 6);
  });
});

describe("computeSheetLayout", () => {
  it("A3 portrait, badge 84x120, AUTO garde l'orientation d'origine (9 contre 8)", () => {
    const l = computeSheetLayout(A3, { widthMm: 84, heightMm: 120 });
    expect([l.rotated, l.columns, l.rows, l.perSheet]).toEqual([false, 3, 3, 9]);
    expect(l.slots).toHaveLength(9);
    expect(l.slots[0].x).toBeCloseTo(17.5, 2);
    expect(l.slots[0].y).toBeCloseTo(25, 2);
    expect(l.slots[1].x).toBeCloseTo(106.5, 2);
    expect(l.slots[3].y).toBeCloseTo(150, 2);
    expect(l.warnings).toEqual([]);
  });

  it("ROTATED force : 2 colonnes x 4 lignes, badge 120x84", () => {
    const l = computeSheetLayout({ ...A3, badgeOrientation: "ROTATED" }, { widthMm: 84, heightMm: 120 });
    expect([l.rotated, l.columns, l.rows]).toEqual([true, 2, 4]);
    expect(l.slots[0].width).toBe(120);
    expect(l.slots[0].height).toBe(84);
  });

  it("A3 paysage : la feuille vaut 420 x 297", () => {
    const l = computeSheetLayout({ ...A3, sheetOrientation: "LANDSCAPE" }, { widthMm: 84, heightMm: 120 });
    expect(l.sheet).toEqual({ width: 420, height: 297 });
  });

  it("AUTO choisit la rotation quand seule elle tient (badge 300x100 sur A3 portrait)", () => {
    const l = computeSheetLayout(A3, { widthMm: 300, heightMm: 100 });
    expect(l.rotated).toBe(true);
  });

  it("ORIGINAL force qui ne tient pas leve BadgeTooLargeError", () => {
    expect(() =>
      computeSheetLayout({ ...A3, badgeOrientation: "ORIGINAL" }, { widthMm: 300, heightMm: 100 }),
    ).toThrow(BadgeTooLargeError);
  });

  it("traits de coupe : 2 par colonne en haut et en bas, 2 par ligne a gauche et a droite", () => {
    const l = computeSheetLayout(A3, { widthMm: 84, heightMm: 120 });
    expect(l.cropMarks).toHaveLength(24);
    expect(l.cropMarks[0]).toEqual({ x1: 17.5, y1: 18, x2: 17.5, y2: 23 });
    // Premier trait gauche : prolonge le bord haut de la premiere ligne.
    const left = l.cropMarks.find((m) => m.y1 === m.y2 && m.x2 < 17.5);
    expect(left).toEqual({ x1: 10.5, y1: 25, x2: 15.5, y2: 25 });
  });

  it("espace reel < 7 mm : traits omis de ce cote + avertissement", () => {
    const l = computeSheetLayout(
      {
        ...A3,
        sheetWidthMm: 200,
        sheetHeightMm: 300,
        marginsMm: { top: 3, right: 3, bottom: 3, left: 3 },
        gapHorizontalMm: 4,
        gapVerticalMm: 4,
      },
      { widthMm: 95, heightMm: 145 },
    );
    expect([l.columns, l.rows]).toEqual([2, 2]);
    expect(l.cropMarks).toEqual([]);
    expect(l.warnings).toEqual([
      "CROP_MARKS_TOP_OMITTED",
      "CROP_MARKS_RIGHT_OMITTED",
      "CROP_MARKS_BOTTOM_OMITTED",
      "CROP_MARKS_LEFT_OMITTED",
    ]);
  });

  it("espace reel >= 7 mm grace au centrage malgre une marge de 3 mm : traits conserves", () => {
    const l = computeSheetLayout(
      { ...A3, marginsMm: { top: 3, right: 3, bottom: 3, left: 3 } },
      { widthMm: 84, heightMm: 120 },
    );
    expect(l.warnings).toEqual([]);
    expect(l.cropMarks).toHaveLength(24);
  });

  it("cropMarks faux : aucun trait, aucun avertissement", () => {
    const l = computeSheetLayout(
      {
        ...A3,
        cropMarks: false,
        sheetWidthMm: 200,
        sheetHeightMm: 300,
        marginsMm: { top: 3, right: 3, bottom: 3, left: 3 },
      },
      { widthMm: 95, heightMm: 145 },
    );
    expect(l.cropMarks).toEqual([]);
    expect(l.warnings).toEqual([]);
  });

  it("ROTATED : grille centree (x0 = 26, y0 = 34.5)", () => {
    const l = computeSheetLayout({ ...A3, badgeOrientation: "ROTATED" }, { widthMm: 84, heightMm: 120 });
    expect(l.slots[0].x).toBeCloseTo(26, 6);
    expect(l.slots[0].y).toBeCloseTo(34.5, 6);
  });

  it("egalite en AUTO : l'orientation d'origine est conservee", () => {
    const l = computeSheetLayout(A3, { widthMm: 100, heightMm: 100 });
    expect(l.rotated).toBe(false);
  });

  it("ajustement exact : trois colonnes tiennent pile (tolerance flottante)", () => {
    const exact = computeSheetLayout(
      { ...A3, sheetWidthMm: 262 + 20, badgeOrientation: "ORIGINAL" },
      { widthMm: 84, heightMm: 120 },
    );
    expect(exact.columns).toBe(3);
    const fractional = computeSheetLayout(
      { ...A3, sheetWidthMm: 3 * 33.3 + 2 * 0.1 + 20, gapHorizontalMm: 0.1, badgeOrientation: "ORIGINAL" },
      { widthMm: 33.3, heightMm: 120 },
    );
    expect(fractional.columns).toBe(3);
  });

  it("limite des 7 mm : exactement 7 garde les traits, 6.9 les omet", () => {
    const base = { ...A3, marginsMm: { top: 0, right: 10, bottom: 0, left: 10 } };
    const keep = computeSheetLayout({ ...base, sheetHeightMm: 384 }, { widthMm: 84, heightMm: 120 });
    expect(keep.warnings).toEqual([]);
    expect(keep.cropMarks).toHaveLength(24);
    const omit = computeSheetLayout({ ...base, sheetHeightMm: 383.8 }, { widthMm: 84, heightMm: 120 });
    expect(omit.warnings).toEqual(["CROP_MARKS_TOP_OMITTED", "CROP_MARKS_BOTTOM_OMITTED"]);
    // Les traits gauche et droite restent : 6 + 6.
    expect(omit.cropMarks).toHaveLength(12);
  });

  it("coordonnees d'un trait du bas et d'un trait de droite", () => {
    const l = computeSheetLayout(A3, { widthMm: 84, heightMm: 120 });
    expect(l.cropMarks).toContainEqual({ x1: 17.5, y1: 397, x2: 17.5, y2: 402 });
    expect(l.cropMarks).toContainEqual({ x1: 281.5, y1: 25, x2: 286.5, y2: 25 });
  });

  it("espace nul : aucun trait en double", () => {
    const l = computeSheetLayout(
      { ...A3, gapHorizontalMm: 0, gapVerticalMm: 0 },
      { widthMm: 84, heightMm: 120 },
    );
    expect(l.perSheet).toBe(9);
    // 4 bords distincts par axe et par cote.
    expect(l.cropMarks).toHaveLength(16);
  });

  it("marges plus grandes que la feuille : BadgeTooLargeError", () => {
    const big = { top: 200, right: 200, bottom: 200, left: 200 };
    expect(() => computeSheetLayout({ ...A3, marginsMm: big }, { widthMm: 84, heightMm: 120 })).toThrow(
      BadgeTooLargeError,
    );
    expect(() =>
      computeSheetLayout(
        { ...A3, marginsMm: { top: 10, right: 200, bottom: 10, left: 200 } },
        { widthMm: 84, heightMm: 120 },
      ),
    ).toThrow(BadgeTooLargeError);
    expect(() =>
      computeSheetLayout(
        { ...A3, marginsMm: { top: 300, right: 10, bottom: 300, left: 10 } },
        { widthMm: 84, heightMm: 120 },
      ),
    ).toThrow(BadgeTooLargeError);
  });

  it("badge de dimension nulle : BadgeTooLargeError", () => {
    expect(() => computeSheetLayout(A3, { widthMm: 0, heightMm: 0 })).toThrow(BadgeTooLargeError);
  });
});
