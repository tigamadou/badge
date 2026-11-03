"use client";

import {
  BadgeTooLargeError,
  computeSheetLayout,
  type LayoutSpec,
  type SheetLayout,
  type SheetWarning,
} from "@/lib/print-sheets/compute-layout";

const WARNING_TEXT: Record<SheetWarning, string> = {
  CROP_MARKS_TOP_OMITTED: "Traits de coupe du haut omis : la marge haute est trop petite (7 mm minimum).",
  CROP_MARKS_RIGHT_OMITTED: "Traits de coupe de droite omis : la marge droite est trop petite (7 mm minimum).",
  CROP_MARKS_BOTTOM_OMITTED: "Traits de coupe du bas omis : la marge basse est trop petite (7 mm minimum).",
  CROP_MARKS_LEFT_OMITTED: "Traits de coupe de gauche omis : la marge gauche est trop petite (7 mm minimum).",
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);

// Disposition calculée, ou tooLarge si le badge ne tient pas sur la feuille.
export function layoutFor(
  spec: LayoutSpec,
  badgeMm: { width: number; height: number } | null,
): { layout: SheetLayout | null; tooLarge: boolean } {
  if (!badgeMm) return { layout: null, tooLarge: false };
  try {
    return { layout: computeSheetLayout(spec, { widthMm: badgeMm.width, heightMm: badgeMm.height }), tooLarge: false };
  } catch (err) {
    if (err instanceof BadgeTooLargeError) return { layout: null, tooLarge: true };
    throw err;
  }
}

// Dessin de la planche (feuille, zone utile, emplacements, traits de coupe), sur fond sombre.
export function SheetDrawing({
  spec,
  layout,
  showDimensions = true,
  className = "",
}: {
  spec: LayoutSpec;
  layout: SheetLayout | null;
  showDimensions?: boolean;
  className?: string;
}) {
  const landscape = spec.sheetOrientation === "LANDSCAPE";
  const sheetW = landscape ? spec.sheetHeightMm : spec.sheetWidthMm;
  const sheetH = landscape ? spec.sheetWidthMm : spec.sheetHeightMm;
  const { top, right, bottom, left } = spec.marginsMm;
  // Taille du texte en mm, proportionnelle a la feuille pour rester lisible.
  const fs = Math.max(sheetW, sheetH) / 40;
  const pad = showDimensions ? 12 : 4;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${sheetW + 2 * pad} ${sheetH + 2 * pad}`}
      className={`mx-auto block ${className}`}
      role="img"
      aria-label={`Aperçu de la planche ${fmt(sheetW)} sur ${fmt(sheetH)} mm`}
    >
      <rect x={0} y={0} width={sheetW} height={sheetH} fill="#fff" rx={1.5} />
      <rect
        x={left}
        y={top}
        width={Math.max(0, sheetW - left - right)}
        height={Math.max(0, sheetH - top - bottom)}
        fill="none"
        stroke="#38bdf8"
        strokeWidth={0.4}
        strokeDasharray="2 2"
      />
      {layout?.slots.map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={s.y} width={s.width} height={s.height} fill="#dcfce7" stroke="#16a34a" strokeWidth={0.4} rx={0.8} />
          <text
            x={s.x + s.width / 2}
            y={s.y + s.height / 2}
            fontSize={fs}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#166534"
          >
            {i + 1}
          </text>
        </g>
      ))}
      {layout?.cropMarks.map((m, i) => (
        <line key={i} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke="#0f172a" strokeWidth={0.25} />
      ))}
      {showDimensions && (
        <>
          {/* Cotes principales, hors feuille : claires sur le fond sombre */}
          <text x={sheetW / 2} y={-4} fontSize={fs} textAnchor="middle" fill="#fff" fillOpacity={0.7}>
            {fmt(sheetW)} mm
          </text>
          <text
            x={-4}
            y={sheetH / 2}
            fontSize={fs}
            textAnchor="middle"
            fill="#fff"
            fillOpacity={0.7}
            transform={`rotate(-90 -4 ${sheetH / 2})`}
          >
            {fmt(sheetH)} mm
          </text>
        </>
      )}
    </svg>
  );
}

export function SheetPreview({
  spec,
  badgeMm,
  badgeCount,
  drawingClassName = "h-auto w-full max-w-md",
}: {
  spec: LayoutSpec;
  badgeMm: { width: number; height: number } | null;
  badgeCount?: number;
  drawingClassName?: string;
}) {
  const { layout, tooLarge } = layoutFor(spec, badgeMm);
  const sheets =
    layout && badgeCount !== undefined && badgeCount > 0
      ? Math.ceil(badgeCount / layout.perSheet)
      : null;

  return (
    <div className="space-y-4 rounded-xl bg-[#1D2128] p-4">
      <SheetDrawing spec={spec} layout={layout} className={drawingClassName} />

      <div className="space-y-1 text-sm">
        {tooLarge && <p className="font-medium text-rose-400">Ce badge ne tient pas dans ce gabarit</p>}
        {!badgeMm && <p className="text-white/50">Choisissez un badge témoin pour voir la disposition.</p>}
        {layout && (
          <>
            <p className="font-medium text-white">
              {layout.perSheet} {layout.perSheet > 1 ? "badges" : "badge"} par feuille
              <span className="font-normal text-white/50">
                {" "}
                ({layout.columns} × {layout.rows}
                {layout.rotated ? ", badge pivoté" : ""})
              </span>
            </p>
            {sheets !== null && (
              <p className="text-white">
                {sheets} {sheets > 1 ? "feuilles" : "feuille"}
              </p>
            )}
            {layout.warnings.map((w) => (
              <p key={w} className="text-amber-300">
                {WARNING_TEXT[w]}
              </p>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
