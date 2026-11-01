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
});
