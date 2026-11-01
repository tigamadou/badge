import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import type { LayoutSpec } from "@/lib/print-sheets/compute-layout";
import { computeSheetLayout } from "@/lib/print-sheets/compute-layout";
import {
  BadgeSizeMismatchError,
  composeSheets,
  slotAnchor,
} from "@/lib/print-sheets/compose";
import { makeBadgePdf } from "./helpers/badge-pdf";

const A3_W = 841.89;
const A3_H = 1190.55;
const BADGE = { width: 84, height: 120 };

const spec: LayoutSpec = {
  sheetWidthMm: 297,
  sheetHeightMm: 420,
  sheetOrientation: "PORTRAIT",
  marginsMm: { top: 10, right: 10, bottom: 10, left: 10 },
  gapHorizontalMm: 4,
  gapVerticalMm: 4,
  badgeOrientation: "ORIGINAL",
  duplexFlip: "LONG_EDGE",
  cropMarks: true,
};

async function badges(count: number, pages: 1 | 2, heightMm = BADGE.height) {
  const one = await makeBadgePdf({ widthMm: BADGE.width, heightMm, pages });
  return Array.from({ length: count }, () => one);
}

afterEach(() => vi.restoreAllMocks());

describe("slotAnchor", () => {
  const slot = { x: 10, y: 20, width: 30, height: 40 };
  it("rotation 0 -> coin bas gauche ; 90 -> (x + width, y) ; 180 -> (x + width, y + height) ; 270 -> (x, y + height)", () => {
    expect(slotAnchor(slot, 0)).toEqual({ x: 10, y: 20 });
    expect(slotAnchor(slot, 90)).toEqual({ x: 40, y: 20 });
    expect(slotAnchor(slot, 180)).toEqual({ x: 40, y: 60 });
    expect(slotAnchor(slot, 270)).toEqual({ x: 10, y: 60 });
  });
});

describe("composeSheets", () => {
  it("20 badges 84x120 sur A3, sans recto-verso : 3 pages de 841.89 x 1190.55 pt", async () => {
    const layout = computeSheetLayout(spec, { widthMm: 84, heightMm: 120 });
    expect(layout.perSheet).toBe(9);
    const out = await composeSheets({
      layout, spec, duplex: false, badgeMm: BADGE, badges: await badges(20, 1),
    });
    expect(out.sheetCount).toBe(3);
    const doc = await PDFDocument.load(out.pdf);
    expect(doc.getPageCount()).toBe(3);
    for (const p of doc.getPages()) {
      expect(p.getWidth()).toBeCloseTo(A3_W, 1);
      expect(p.getHeight()).toBeCloseTo(A3_H, 1);
    }
  });

  it("recto-verso : 6 pages, page 2 = verso de la feuille 1", async () => {
    const layout = computeSheetLayout(spec, { widthMm: 84, heightMm: 120 });
    const draw = vi.spyOn(PDFPage.prototype, "drawPage");
    const out = await composeSheets({
      layout, spec, duplex: true, badgeMm: BADGE, badges: await badges(20, 2),
    });
    const doc = await PDFDocument.load(out.pdf);
    expect(doc.getPageCount()).toBe(6);
    // Les appels alternent recto/verso par badge ; le verso est en miroir sur l'axe long.
    const badgeW = (84 * 72) / 25.4;
    for (let i = 0; i < 9; i++) {
      const recto = draw.mock.calls[2 * i][1] as { x: number; y: number };
      const verso = draw.mock.calls[2 * i + 1][1] as { x: number; y: number };
      expect(verso.x).toBeCloseTo(A3_W - recto.x - badgeW, 2);
      expect(verso.y).toBeCloseTo(recto.y, 2);
    }
  });

  it("chaque badge est pose a 100 % : les XObjects dessines font 238.11 x 340.16 pt", async () => {
    const layout = computeSheetLayout({ ...spec, badgeOrientation: "ROTATED" }, { widthMm: 84, heightMm: 120 });
    const draw = vi.spyOn(PDFPage.prototype, "drawPage");
    await composeSheets({
      layout, spec: { ...spec, badgeOrientation: "ROTATED" }, duplex: true, badgeMm: BADGE, badges: await badges(5, 2),
    });
    expect(draw).toHaveBeenCalledTimes(10);
    for (const [, o] of draw.mock.calls) {
      expect(o!.width).toBeCloseTo(238.11, 2);
      expect(o!.height).toBeCloseTo(340.16, 2);
    }
  });

  it("une page de badge de 84 x 121 mm leve BadgeSizeMismatchError(index, 0)", async () => {
    const layout = computeSheetLayout(spec, { widthMm: 84, heightMm: 120 });
    const good = await makeBadgePdf({ widthMm: 84, heightMm: 120, pages: 1 });
    const bad = await makeBadgePdf({ widthMm: 84, heightMm: 121, pages: 1 });
    const err = await composeSheets({
      layout, spec, duplex: false, badgeMm: BADGE, badges: [good, bad],
    }).catch((e) => e);
    expect(err).toBeInstanceOf(BadgeSizeMismatchError);
    expect(err.badgeIndex).toBe(1);
    expect(err.pageIndex).toBe(0);
  });

  it("une page verso de taille differente leve BadgeSizeMismatchError(index, 1)", async () => {
    const layout = computeSheetLayout(spec, { widthMm: 84, heightMm: 120 });
    const doc = await PDFDocument.create();
    doc.addPage([(84 * 72) / 25.4, (120 * 72) / 25.4]);
    doc.addPage([(84 * 72) / 25.4, (121 * 72) / 25.4]);
    const err = await composeSheets({
      layout, spec, duplex: true, badgeMm: BADGE, badges: [await doc.save()],
    }).catch((e) => e);
    expect(err).toBeInstanceOf(BadgeSizeMismatchError);
    expect([err.badgeIndex, err.pageIndex]).toEqual([0, 1]);
  });

  it("recto-verso demande avec un badge d'une seule page leve BadgeSizeMismatchError(index, 1)", async () => {
    const layout = computeSheetLayout(spec, { widthMm: 84, heightMm: 120 });
    const err = await composeSheets({
      layout, spec, duplex: true, badgeMm: BADGE, badges: await badges(2, 1),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(BadgeSizeMismatchError);
    expect([err.badgeIndex, err.pageIndex]).toEqual([0, 1]);
    expect(err.name).toBe("BadgeSizeMismatchError");
  });

  it("traits de coupe : drawLine appele layout.cropMarks.length fois par feuille recto, jamais au verso", async () => {
    const layout = computeSheetLayout(spec, { widthMm: 84, heightMm: 120 });
    expect(layout.cropMarks.length).toBeGreaterThan(0);
    const line = vi.spyOn(PDFPage.prototype, "drawLine");
    await composeSheets({
      layout, spec, duplex: true, badgeMm: BADGE, badges: await badges(20, 2),
    });
    expect(line).toHaveBeenCalledTimes(3 * layout.cropMarks.length);
    for (const [o] of line.mock.calls) expect(o.thickness).toBe(0.25);
  });

  it("sans traits de coupe demandes, aucune ligne n'est tracee", async () => {
    const s = { ...spec, cropMarks: false };
    const layout = computeSheetLayout(s, { widthMm: 84, heightMm: 120 });
    const line = vi.spyOn(PDFPage.prototype, "drawLine");
    await composeSheets({ layout, spec: s, duplex: false, badgeMm: BADGE, badges: await badges(2, 1) });
    expect(line).not.toHaveBeenCalled();
  });
});
