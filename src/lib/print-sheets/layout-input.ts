// Schema zod des gabarits d'impression et conversion vers LayoutSpec.
// Importable depuis le navigateur : aucun import serveur (types seulement).
import { z } from "zod";
import type { PrintSheetLayout } from "@prisma/client";
import { tenthsToMm } from "./units";
import type { LayoutSpec } from "./compute-layout";

// Toutes les longueurs sont en dixiemes de mm.
const sheetSide = z.number().int().min(500).max(20000);
const margin = z.number().int().min(0).max(1000);

export const layoutFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sheetWidth: sheetSide,
  sheetHeight: sheetSide,
  sheetOrientation: z.enum(["PORTRAIT", "LANDSCAPE"]),
  marginTop: margin,
  marginRight: margin,
  marginBottom: margin,
  marginLeft: margin,
  gapHorizontal: margin,
  gapVertical: margin,
  badgeOrientation: z.enum(["AUTO", "ORIGINAL", "ROTATED"]),
  duplexFlip: z.enum(["LONG_EDGE", "SHORT_EDGE"]),
  cropMarks: z.boolean(),
});

export const WIDTH_GT_HEIGHT_MESSAGE =
  "La largeur de la planche doit etre inferieure ou egale a sa hauteur";

export const layoutInputSchema = layoutFieldsSchema.refine(
  (v) => v.sheetWidth <= v.sheetHeight,
  { message: WIDTH_GT_HEIGHT_MESSAGE, path: ["sheetWidth"] },
);

export type LayoutInput = z.infer<typeof layoutInputSchema>;

export type LayoutGeometryRow = Pick<
  PrintSheetLayout,
  | "sheetWidth"
  | "sheetHeight"
  | "sheetOrientation"
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft"
  | "gapHorizontal"
  | "gapVertical"
  | "badgeOrientation"
  | "duplexFlip"
  | "cropMarks"
>;

export function toLayoutSpec(row: LayoutGeometryRow): LayoutSpec {
  return {
    sheetWidthMm: tenthsToMm(row.sheetWidth),
    sheetHeightMm: tenthsToMm(row.sheetHeight),
    sheetOrientation: row.sheetOrientation,
    marginsMm: {
      top: tenthsToMm(row.marginTop),
      right: tenthsToMm(row.marginRight),
      bottom: tenthsToMm(row.marginBottom),
      left: tenthsToMm(row.marginLeft),
    },
    gapHorizontalMm: tenthsToMm(row.gapHorizontal),
    gapVerticalMm: tenthsToMm(row.gapVertical),
    badgeOrientation: row.badgeOrientation,
    duplexFlip: row.duplexFlip,
    cropMarks: row.cropMarks,
  };
}
