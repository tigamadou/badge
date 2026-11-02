"use client";

import Link from "next/link";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import type { OrderSheetView } from "@/lib/print-sheets/order-sheet";

const STATE_LABEL = {
  NONE: "À générer",
  RUNNING: "En cours",
  DONE: "Prête",
  FAILED: "Échec",
} as const;

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

// Planche d'une commande : état, chiffres, téléchargement, aperçu PDF en modale.
export function OrderSheetPanel({ sheet, sheetsHref }: { sheet: OrderSheetView | null; sheetsHref: string }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const state = !sheet ? "NONE" : sheet.status === "DONE" ? "DONE" : sheet.status === "FAILED" ? "FAILED" : "RUNNING";

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Planche</h3>
        <span className="text-xs font-medium text-slate-600">{STATE_LABEL[state]}</span>
      </div>

      {sheet && state === "DONE" ? (
        <p className="text-sm text-slate-600">
          {sheet.badgeCount !== null ? `${plural(sheet.badgeCount, "badge", "badges")} · ` : ""}
          {sheet.sheetCount !== null ? `${plural(sheet.sheetCount, "feuille", "feuilles")} · ` : ""}
          {sheet.pageCount !== null ? `${plural(sheet.pageCount, "page", "pages")} · ` : ""}
          {sheet.duplex ? "recto-verso" : "recto seul"}
          {sheet.layoutName ? ` · ${sheet.layoutName}` : ""}
        </p>
      ) : null}
      {state === "FAILED" ? <p className="text-sm text-rose-600">{sheet?.error ?? "La génération a échoué."}</p> : null}
      {state === "NONE" ? <p className="text-sm text-slate-500">Aucune planche générée pour cette commande.</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        {sheet?.downloadUrl ? (
          <>
            <a
              href={sheet.downloadUrl}
              className="inline-flex rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Télécharger
            </a>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Voir la planche
            </button>
          </>
        ) : null}
        <Link href={sheetsHref} className="text-[13px] font-medium text-green-700 hover:underline">
          Gérer dans Planches
        </Link>
      </div>

      {sheet?.downloadUrl ? (
        <Dialog open={previewOpen} title="Planche de la commande" onClose={() => setPreviewOpen(false)}>
          <iframe src={sheet.downloadUrl} title="Aperçu de la planche" className="h-[60vh] w-full rounded-lg border border-slate-200" />
        </Dialog>
      ) : null}
    </div>
  );
}
