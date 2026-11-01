// Composition des planches d'impression en PDF : chaque badge est pose a 100 %
// (jamais mis a l'echelle) dans son emplacement, avec traits de coupe au recto.
import { PDFDocument, PDFEmbeddedPage, PDFPage, degrees, rgb } from "pdf-lib";
import type { LayoutSpec, Rect, SheetLayout } from "./compute-layout";
import { pageNumber, planPlacements, type Rotation } from "./placements";
import { mmToPt } from "./units";

// Ecart maximal admis entre la page d'un badge et la taille attendue.
const SIZE_TOLERANCE_MM = 0.01;
const CROP_THICKNESS_PT = 0.25;

export class BadgeSizeMismatchError extends Error {
  constructor(
    readonly badgeIndex: number,
    readonly pageIndex: number,
  ) {
    super(`La page ${pageIndex} du badge ${badgeIndex} n'a pas la taille attendue`);
    this.name = "BadgeSizeMismatchError";
  }
}

// pdf-lib tourne autour du point d'ancrage (sens anti-horaire) : on choisit le
// coin du rectangle (repere PDF, origine en bas a gauche) qui, apres rotation,
// laisse la page remplir exactement le rectangle.
export function slotAnchor(
  slotPt: Rect,
  rotation: Rotation,
): { x: number; y: number } {
  const { x, y, width, height } = slotPt;
  switch (rotation) {
    case 0:
      return { x, y };
    case 90:
      return { x: x + width, y };
    case 180:
      return { x: x + width, y: y + height };
    case 270:
      return { x, y: y + height };
  }
}

const ptToMm = (pt: number) => (pt * 25.4) / 72;

export async function composeSheets(input: {
  layout: SheetLayout;
  spec: LayoutSpec;
  duplex: boolean;
  badgeMm: { width: number; height: number };
  badges: Uint8Array[];
}): Promise<{ pdf: Uint8Array; sheetCount: number }> {
  const { layout, spec, duplex, badgeMm, badges } = input;
  const out = await PDFDocument.create();

  // Controle puis incorporation de chaque badge (une seule fois chacun).
  const wanted = duplex ? [0, 1] : [0];
  const embedded: PDFEmbeddedPage[][] = [];
  for (let b = 0; b < badges.length; b++) {
    const src = await PDFDocument.load(badges[b]);
    const pages = src.getPages();
    for (const p of wanted) {
      if (p >= pages.length) throw new BadgeSizeMismatchError(b, p);
      const { width, height } = pages[p].getSize();
      if (
        Math.abs(ptToMm(width) - badgeMm.width) > SIZE_TOLERANCE_MM ||
        Math.abs(ptToMm(height) - badgeMm.height) > SIZE_TOLERANCE_MM
      ) {
        throw new BadgeSizeMismatchError(b, p);
      }
    }
    embedded.push(await out.embedPdf(src, wanted));
  }

  const { sheetCount, placements } = planPlacements(layout, spec, {
    badgeCount: badges.length,
    duplex,
  });
  const sheetHeightMm = layout.sheet.height;
  const sheetSizePt: [number, number] = [
    mmToPt(layout.sheet.width),
    mmToPt(sheetHeightMm),
  ];

  // Pages creees d'avance : les placements alternent recto et verso par badge.
  const pages: PDFPage[] = [];
  for (let sheet = 0; sheet < sheetCount; sheet++) {
    for (const face of duplex ? (["RECTO", "VERSO"] as const) : (["RECTO"] as const)) {
      const page = out.addPage(sheetSizePt);
      pages.push(page);
      if (face === "RECTO") {
        for (const m of layout.cropMarks) {
          page.drawLine({
            start: { x: mmToPt(m.x1), y: mmToPt(sheetHeightMm - m.y1) },
            end: { x: mmToPt(m.x2), y: mmToPt(sheetHeightMm - m.y2) },
            thickness: CROP_THICKNESS_PT,
            color: rgb(0, 0, 0),
          });
        }
      }
    }
  }

  for (const pl of placements) {
    const slotPt: Rect = {
      x: mmToPt(pl.slot.x),
      y: mmToPt(sheetHeightMm - pl.slot.y - pl.slot.height),
      width: mmToPt(pl.slot.width),
      height: mmToPt(pl.slot.height),
    };
    const face = embedded[pl.badgeIndex][pl.pageIndex];
    const anchor = slotAnchor(slotPt, pl.rotation);
    // Taille propre a la page du badge : pas de mise a l'echelle.
    pages[pageNumber(pl.sheetIndex, pl.face, duplex) - 1].drawPage(face, {
      x: anchor.x,
      y: anchor.y,
      width: face.width,
      height: face.height,
      rotate: degrees(pl.rotation),
    });
  }

  return { pdf: await out.save(), sheetCount };
}
