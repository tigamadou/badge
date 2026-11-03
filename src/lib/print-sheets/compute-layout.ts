// Calcul de la grille de badges sur une planche. Pur, sans import serveur :
// utilise aussi par l'apercu navigateur. Repere : mm, origine en haut a gauche.

export type LayoutSpec = {
  sheetWidthMm: number;
  sheetHeightMm: number;
  sheetOrientation: "PORTRAIT" | "LANDSCAPE";
  marginsMm: { top: number; right: number; bottom: number; left: number };
  gapHorizontalMm: number;
  gapVerticalMm: number;
  badgeOrientation: "AUTO" | "ORIGINAL" | "ROTATED";
  duplexFlip: "LONG_EDGE" | "SHORT_EDGE";
  cropMarks: boolean;
};

export type Rect = { x: number; y: number; width: number; height: number };
export type CropMark = { x1: number; y1: number; x2: number; y2: number };

export type SheetWarning =
  | "CROP_MARKS_TOP_OMITTED"
  | "CROP_MARKS_RIGHT_OMITTED"
  | "CROP_MARKS_BOTTOM_OMITTED"
  | "CROP_MARKS_LEFT_OMITTED";

export type SheetLayout = {
  sheet: { width: number; height: number };
  rotated: boolean;
  columns: number;
  rows: number;
  perSheet: number;
  slots: Rect[];
  cropMarks: CropMark[];
  warnings: SheetWarning[];
};

export class BadgeTooLargeError extends Error {
  constructor() {
    super("Le badge ne tient pas sur la planche");
    this.name = "BadgeTooLargeError";
  }
}

const MARK_LENGTH_MM = 5;
const MARK_OFFSET_MM = 2;
const MARK_MIN_SPACE_MM = MARK_LENGTH_MM + MARK_OFFSET_MM;
// Tolerance flottante pour que 3 * 89 - 5 ne perde pas une colonne a 1e-13 pres.
const EPS = 1e-9;

function fit(available: number, size: number, gap: number): number {
  return Math.max(0, Math.floor((available + gap) / (size + gap) + EPS));
}

// Bords uniques (tolerance EPS) : avec un espace nul, le bord droit d'une
// colonne et le bord gauche de la suivante sont confondus.
function uniqueEdges(edges: number[]): number[] {
  const out: number[] = [];
  for (const e of edges) {
    if (!out.some((o) => Math.abs(o - e) < EPS)) out.push(e);
  }
  return out;
}

export function computeSheetLayout(
  spec: LayoutSpec,
  badge: { widthMm: number; heightMm: number },
): SheetLayout {
  if (!(badge.widthMm > 0) || !(badge.heightMm > 0)) throw new BadgeTooLargeError();
  const landscape = spec.sheetOrientation === "LANDSCAPE";
  const sheetW = landscape ? spec.sheetHeightMm : spec.sheetWidthMm;
  const sheetH = landscape ? spec.sheetWidthMm : spec.sheetHeightMm;
  const { top, right, bottom, left } = spec.marginsMm;
  const usableW = sheetW - left - right;
  const usableH = sheetH - top - bottom;

  const count = (w: number, h: number) => ({
    columns: fit(usableW, w, spec.gapHorizontalMm),
    rows: fit(usableH, h, spec.gapVerticalMm),
  });
  const original = count(badge.widthMm, badge.heightMm);
  const turned = count(badge.heightMm, badge.widthMm);

  let rotated: boolean;
  if (spec.badgeOrientation === "ORIGINAL") rotated = false;
  else if (spec.badgeOrientation === "ROTATED") rotated = true;
  else rotated = turned.columns * turned.rows > original.columns * original.rows;

  const { columns, rows } = rotated ? turned : original;
  const perSheet = columns * rows;
  if (perSheet === 0) throw new BadgeTooLargeError();

  const w = rotated ? badge.heightMm : badge.widthMm;
  const h = rotated ? badge.widthMm : badge.heightMm;
  const gridW = columns * w + (columns - 1) * spec.gapHorizontalMm;
  const gridH = rows * h + (rows - 1) * spec.gapVerticalMm;
  const x0 = left + (usableW - gridW) / 2;
  const y0 = top + (usableH - gridH) / 2;

  const slots: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      slots.push({
        x: x0 + c * (w + spec.gapHorizontalMm),
        y: y0 + r * (h + spec.gapVerticalMm),
        width: w,
        height: h,
      });
    }
  }

  const cropMarks: CropMark[] = [];
  const warnings: SheetWarning[] = [];
  if (spec.cropMarks) {
    const x1 = x0 + gridW;
    const y1 = y0 + gridH;
    const colEdges = uniqueEdges(slots.slice(0, columns).flatMap((s) => [s.x, s.x + s.width]));
    const rowEdges = uniqueEdges(
      slots.filter((_, i) => i % columns === 0).flatMap((s) => [s.y, s.y + s.height]),
    );

    if (y0 >= MARK_MIN_SPACE_MM - EPS) {
      for (const x of colEdges) {
        cropMarks.push({ x1: x, y1: y0 - MARK_MIN_SPACE_MM, x2: x, y2: y0 - MARK_OFFSET_MM });
      }
    } else warnings.push("CROP_MARKS_TOP_OMITTED");

    if (sheetW - x1 >= MARK_MIN_SPACE_MM - EPS) {
      for (const y of rowEdges) {
        cropMarks.push({ x1: x1 + MARK_OFFSET_MM, y1: y, x2: x1 + MARK_MIN_SPACE_MM, y2: y });
      }
    } else warnings.push("CROP_MARKS_RIGHT_OMITTED");

    if (sheetH - y1 >= MARK_MIN_SPACE_MM - EPS) {
      for (const x of colEdges) {
        cropMarks.push({ x1: x, y1: y1 + MARK_OFFSET_MM, x2: x, y2: y1 + MARK_MIN_SPACE_MM });
      }
    } else warnings.push("CROP_MARKS_BOTTOM_OMITTED");

    if (x0 >= MARK_MIN_SPACE_MM - EPS) {
      for (const y of rowEdges) {
        cropMarks.push({ x1: x0 - MARK_MIN_SPACE_MM, y1: y, x2: x0 - MARK_OFFSET_MM, y2: y });
      }
    } else warnings.push("CROP_MARKS_LEFT_OMITTED");
  }

  return {
    sheet: { width: sheetW, height: sheetH },
    rotated,
    columns,
    rows,
    perSheet,
    slots,
    cropMarks,
    warnings,
  };
}
