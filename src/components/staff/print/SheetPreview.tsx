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

export function SheetPreview({
  spec,
  badgeMm,
  badgeCount,
}: {
  spec: LayoutSpec;
  badgeMm: { width: number; height: number } | null;
  badgeCount?: number;
}) {
  let layout: SheetLayout | null = null;
  let tooLarge = false;
  if (badgeMm) {
    try {
      layout = computeSheetLayout(spec, { widthMm: badgeMm.width, heightMm: badgeMm.height });
    } catch (err) {
      if (err instanceof BadgeTooLargeError) tooLarge = true;
      else throw err;
    }
  }

  const landscape = spec.sheetOrientation === "LANDSCAPE";
  const sheetW = landscape ? spec.sheetHeightMm : spec.sheetWidthMm;
  const sheetH = landscape ? spec.sheetWidthMm : spec.sheetHeightMm;
  const { top, right, bottom, left } = spec.marginsMm;
  // Taille du texte en mm, proportionnelle a la feuille pour rester lisible.
  const fs = Math.max(sheetW, sheetH) / 40;
  const sheets =
    layout && badgeCount !== undefined && badgeCount > 0
      ? Math.ceil(badgeCount / layout.perSheet)
      : null;

  return (
    <div className="space-y-3">
      <svg
        viewBox={`${-12} ${-12} ${sheetW + 24} ${sheetH + 24}`}
        className="mx-auto block h-auto w-full max-w-md rounded-lg bg-slate-50"
        role="img"
        aria-label={`Aperçu de la planche ${fmt(sheetW)} sur ${fmt(sheetH)} mm`}
      >
        <rect x={0} y={0} width={sheetW} height={sheetH} fill="#fff" stroke="#94a3b8" strokeWidth={0.4} />
        <rect
          x={left}
          y={top}
          width={Math.max(0, sheetW - left - right)}
          height={Math.max(0, sheetH - top - bottom)}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={0.3}
          strokeDasharray="2 2"
        />
        {layout?.slots.map((s, i) => (
          <g key={i}>
            <rect x={s.x} y={s.y} width={s.width} height={s.height} fill="#dcfce7" stroke="#16a34a" strokeWidth={0.3} />
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
        {/* Cotes principales */}
        <text x={sheetW / 2} y={-4} fontSize={fs} textAnchor="middle" fill="#475569">
          {fmt(sheetW)} mm
        </text>
        <text
          x={-4}
          y={sheetH / 2}
          fontSize={fs}
          textAnchor="middle"
          fill="#475569"
          transform={`rotate(-90 -4 ${sheetH / 2})`}
        >
          {fmt(sheetH)} mm
        </text>
      </svg>

      <div className="space-y-1 text-sm">
        {tooLarge && (
          <p className="font-medium text-rose-600">Ce badge ne tient pas dans ce gabarit</p>
        )}
        {!badgeMm && <p className="text-slate-500">Choisissez un badge témoin pour voir la disposition.</p>}
        {layout && (
          <>
            <p className="font-medium text-slate-900">
              {layout.perSheet} {layout.perSheet > 1 ? "badges" : "badge"} par feuille
              <span className="font-normal text-slate-500">
                {" "}
                ({layout.columns} × {layout.rows}
                {layout.rotated ? ", badge pivoté" : ""})
              </span>
            </p>
            {sheets !== null && (
              <p className="text-slate-700">
                {sheets} {sheets > 1 ? "feuilles" : "feuille"}
              </p>
            )}
            {layout.warnings.map((w) => (
              <p key={w} className="text-amber-700">
                {WARNING_TEXT[w]}
              </p>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
