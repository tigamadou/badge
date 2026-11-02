// Formulaire de gabarit : conversions entre la ligne en base (dixiemes de mm), la saisie
// (chaines en mm) et la spec de calcul. Pur, partage par la liste et l'editeur.
import {
  BadgeTooLargeError,
  computeSheetLayout,
  type LayoutSpec,
} from "@/lib/print-sheets/compute-layout";
import { mmToTenths, tenthsToMm } from "@/lib/print-sheets/units";

// Longueurs en dixièmes de mm, comme en base.
export type LayoutRow = {
  id: string;
  name: string;
  sheetWidth: number;
  sheetHeight: number;
  sheetOrientation: "PORTRAIT" | "LANDSCAPE";
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  gapHorizontal: number;
  gapVertical: number;
  badgeOrientation: "AUTO" | "ORIGINAL" | "ROTATED";
  duplexFlip: "LONG_EDGE" | "SHORT_EDGE";
  cropMarks: boolean;
};

export type TemplateOption = { id: string; label: string; pages: number; widthMm: number; heightMm: number };

export const PRESETS: Record<string, { label: string; w: number; h: number }> = {
  A3: { label: "A3", w: 297, h: 420 },
  A4: { label: "A4", w: 210, h: 297 },
  SRA3: { label: "SRA3", w: 320, h: 450 },
};

export type LayoutForm = {
  name: string;
  preset: string; // A3 | A4 | SRA3 | FREE
  sheetWidth: string;
  sheetHeight: string;
  sheetOrientation: "PORTRAIT" | "LANDSCAPE";
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  gapHorizontal: string;
  gapVertical: string;
  badgeOrientation: "AUTO" | "ORIGINAL" | "ROTATED";
  duplexFlip: "LONG_EDGE" | "SHORT_EDGE";
  cropMarks: boolean;
};

export const EMPTY_FORM: LayoutForm = {
  name: "",
  preset: "A3",
  sheetWidth: "297",
  sheetHeight: "420",
  sheetOrientation: "PORTRAIT",
  marginTop: "10",
  marginRight: "10",
  marginBottom: "10",
  marginLeft: "10",
  gapHorizontal: "0",
  gapVertical: "0",
  badgeOrientation: "AUTO",
  duplexFlip: "LONG_EDGE",
  cropMarks: true,
};

const mmStr = (tenths: number) => String(tenthsToMm(tenths));

export function toForm(r: LayoutRow): LayoutForm {
  const w = tenthsToMm(r.sheetWidth);
  const h = tenthsToMm(r.sheetHeight);
  const preset = Object.entries(PRESETS).find(([, p]) => p.w === w && p.h === h)?.[0] ?? "FREE";
  return {
    name: r.name,
    preset,
    sheetWidth: String(w),
    sheetHeight: String(h),
    sheetOrientation: r.sheetOrientation,
    marginTop: mmStr(r.marginTop),
    marginRight: mmStr(r.marginRight),
    marginBottom: mmStr(r.marginBottom),
    marginLeft: mmStr(r.marginLeft),
    gapHorizontal: mmStr(r.gapHorizontal),
    gapVertical: mmStr(r.gapVertical),
    badgeOrientation: r.badgeOrientation,
    duplexFlip: r.duplexFlip,
    cropMarks: r.cropMarks,
  };
}

// Saisie en mm -> nombre, ou null si vide / invalide.
export function parseMm(v: string): number | null {
  const n = Number(v.replace(",", "."));
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
}

// Spec pour l'aperçu ; null tant qu'une valeur est invalide.
export function formToSpec(f: LayoutForm): LayoutSpec | null {
  const nums = [
    f.sheetWidth, f.sheetHeight, f.marginTop, f.marginRight, f.marginBottom,
    f.marginLeft, f.gapHorizontal, f.gapVertical,
  ].map(parseMm);
  if (nums.some((n) => n === null || n < 0)) return null;
  const [sw, sh, mt, mr, mb, ml, gh, gv] = nums as number[];
  if (sw <= 0 || sh <= 0) return null;
  return {
    sheetWidthMm: sw,
    sheetHeightMm: sh,
    sheetOrientation: f.sheetOrientation,
    marginsMm: { top: mt, right: mr, bottom: mb, left: ml },
    gapHorizontalMm: gh,
    gapVerticalMm: gv,
    badgeOrientation: f.badgeOrientation,
    duplexFlip: f.duplexFlip,
    cropMarks: f.cropMarks,
  };
}

export function formToBody(f: LayoutForm) {
  const t = (v: string) => mmToTenths(parseMm(v) ?? 0);
  return {
    name: f.name.trim(),
    sheetWidth: t(f.sheetWidth),
    sheetHeight: t(f.sheetHeight),
    sheetOrientation: f.sheetOrientation,
    marginTop: t(f.marginTop),
    marginRight: t(f.marginRight),
    marginBottom: t(f.marginBottom),
    marginLeft: t(f.marginLeft),
    gapHorizontal: t(f.gapHorizontal),
    gapVertical: t(f.gapVertical),
    badgeOrientation: f.badgeOrientation,
    duplexFlip: f.duplexFlip,
    cropMarks: f.cropMarks,
  };
}

export function rowSpec(r: LayoutRow): LayoutSpec {
  return formToSpec(toForm(r)) as LayoutSpec;
}

// Nombre de badges par feuille ; 0 si le badge ne tient pas, null sans badge temoin.
export function perSheetFor(spec: LayoutSpec | null, badge: { width: number; height: number } | null) {
  if (!spec || !badge) return null;
  try {
    return computeSheetLayout(spec, { widthMm: badge.width, heightMm: badge.height }).perSheet;
  } catch (err) {
    if (err instanceof BadgeTooLargeError) return 0;
    throw err;
  }
}

export const ORIENTATION_LABEL = { PORTRAIT: "Portrait", LANDSCAPE: "Paysage" } as const;
export const FLIP_LABEL = { LONG_EDGE: "Bord long", SHORT_EDGE: "Bord court" } as const;
