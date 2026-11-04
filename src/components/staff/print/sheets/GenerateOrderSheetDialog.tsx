"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { SheetPreview } from "@/components/staff/print/SheetPreview";
import type { LayoutOption } from "@/components/staff/print/GenerationForm";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { toastSuccess } from "@/lib/toast";
import { toLayoutSpec } from "@/lib/print-sheets/layout-input";
import type { OrderQueueRow } from "@/lib/print-sheets/order-queue";

// Choix du gabarit pour la planche d'une commande (première génération ou regénération).
export function GenerateOrderSheetDialog({
  row,
  layouts,
  regenerate,
  onClose,
  onDone,
}: {
  row: OrderQueueRow;
  layouts: LayoutOption[];
  regenerate: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [layoutId, setLayoutId] = useState(layouts[0]?.id ?? "");
  const [badgeMm, setBadgeMm] = useState<{ width: number; height: number } | null>(null);
  const layout = layouts.find((l) => l.id === layoutId);
  const spec = useMemo(() => (layout ? toLayoutSpec(layout) : null), [layout]);

  // Format du badge de la commande, pour l'aperçu de la disposition.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/platform/print/sheets/options?eventId=${encodeURIComponent(row.eventId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => !cancelled && setBadgeMm(j.event.badgeMm))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [row.eventId]);

  const submit = useAsyncAction(
    async () => {
      const res = await fetch("/api/platform/print/sheets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: row.eventId,
          layoutId,
          selection: { mode: "REQUEST" },
          duplex: row.badgePages === 2,
          printRequestId: row.requestId,
        }),
      });
      if (!res.ok) throw res;
    },
    {
      error: "Échec du lancement de la génération.",
      onSuccess: () => {
        toastSuccess(regenerate ? "Regénération lancée." : "Génération lancée.");
        onDone();
      },
    },
  );

  return (
    <Dialog
      open
      title={`${regenerate ? "Regénérer" : "Générer"} la planche — ${row.reference}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" disabled={!layout} loading={submit.pending} onClick={() => void submit.run()}>
            {regenerate ? "Regénérer" : "Générer"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {row.badgeCount} badge{row.badgeCount > 1 ? "s" : ""}
          {row.badgePages === 2 ? " · recto-verso imposé par le template" : " · recto seul"}
        </p>
        <Select
          label="Gabarit"
          value={layoutId}
          onChange={(e) => setLayoutId(e.target.value)}
          options={layouts.map((l) => ({ value: l.id, label: l.name }))}
        />
        {layouts.length === 0 && (
          <p className="text-sm text-slate-400">Aucun gabarit : créez-en un dans « Gabarits » avant de générer.</p>
        )}
        {regenerate && (
          <p className="text-sm text-warn">La planche actuelle sera remplacée.</p>
        )}
        {spec && <SheetPreview spec={spec} badgeMm={badgeMm} badgeCount={row.badgeCount} drawingClassName="h-auto w-full max-w-xs" />}
      </div>
    </Dialog>
  );
}
