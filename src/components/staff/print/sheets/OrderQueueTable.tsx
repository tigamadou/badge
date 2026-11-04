"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Table } from "@/components/ui/Table";
import type { LayoutOption } from "@/components/staff/print/GenerationForm";
import { GenerateOrderSheetDialog } from "@/components/staff/print/sheets/GenerateOrderSheetDialog";
import type { OrderQueueRow } from "@/lib/print-sheets/order-queue";
import { mergeRows } from "@/components/staff/print/sheets/merge-rows";

export const ORDER_REFRESH_INTERVAL_MS = 5000;

const SHEET_STATE = {
  PENDING: { label: "En attente", className: "bg-amber-50 text-amber-700" },
  RUNNING: { label: "En cours", className: "bg-sky-50 text-sky-700" },
  DONE: { label: "Prête", className: "bg-emerald-50 text-emerald-700" },
  FAILED: { label: "Échec", className: "bg-rose-50 text-rose-700" },
} as const;

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");

const isActive = (r: OrderQueueRow) => r.sheet?.status === "PENDING" || r.sheet?.status === "RUNNING";

// File des commandes : « À traiter » (génération) ou « Générées » (état, téléchargement, regénération).
export function OrderQueueTable({
  mode,
  initial,
  layouts,
}: {
  mode: "pending" | "generated";
  initial: OrderQueueRow[];
  layouts: LayoutOption[];
}) {
  const router = useRouter();
  // Lignes rafraîchies par polling, valables tant que les données serveur n'ont pas changé.
  const [polled, setPolled] = useState<{ from: OrderQueueRow[]; rows: OrderQueueRow[] } | null>(null);
  const rows = polled && polled.from === initial ? polled.rows : initial;
  const [target, setTarget] = useState<OrderQueueRow | null>(null);
  const [preview, setPreview] = useState<OrderQueueRow | null>(null);
  const inFlight = useRef(false);
  const generated = mode === "generated";
  const active = generated && rows.some(isActive);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/platform/print/sheets/orders");
      if (res.ok) {
        // L'API renvoie la file complete : seules les lignes de la page affichee sont mises a jour.
        const fresh = (await res.json()).orders as OrderQueueRow[];
        setPolled({ from: initial, rows: mergeRows(initial, fresh, (r) => r.requestId) });
      }
    } catch {
      // Réseau coupé : le prochain tick réessaie.
    } finally {
      inFlight.current = false;
    }
  }, [initial]);

  // Rafraîchit toutes les 5 s tant qu'une planche est en attente ou en cours, onglet visible.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, ORDER_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, refresh]);

  function done() {
    setTarget(null);
    router.refresh();
  }

  const common = [
    {
      key: "reference",
      header: "Commande",
      render: (r: OrderQueueRow) => (
        <Link href={`/platform/print/orders/${r.requestId}`} className="font-medium text-green-700 hover:underline">
          {r.reference}
        </Link>
      ),
    },
    { key: "event", header: "Évènement", render: (r: OrderQueueRow) => r.eventTitle },
    { key: "org", header: "Organisation", render: (r: OrderQueueRow) => r.orgName },
    { key: "badges", header: "Badges", render: (r: OrderQueueRow) => r.badgeCount },
    { key: "duplex", header: "Recto-verso", render: (r: OrderQueueRow) => (r.badgePages === 2 ? "Oui" : "Non") },
    { key: "paid", header: "Payée le", render: (r: OrderQueueRow) => fmtDate(r.paidAt) },
  ];

  const columns = generated
    ? [
        ...common,
        {
          key: "state",
          header: "État",
          render: (r: OrderQueueRow) =>
            r.sheet && (
              <div className="space-y-1">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${SHEET_STATE[r.sheet.status].className}`}>
                  {SHEET_STATE[r.sheet.status].label}
                </span>
                {r.sheet.status === "FAILED" && (
                  <p className="text-xs text-rose-600">{r.sheet.error ?? "Erreur inconnue."}</p>
                )}
              </div>
            ),
        },
        { key: "layout", header: "Gabarit", render: (r: OrderQueueRow) => r.sheet?.layoutName ?? "—" },
        {
          key: "pages",
          header: "Feuilles / pages",
          render: (r: OrderQueueRow) =>
            r.sheet?.sheetCount != null ? `${r.sheet.sheetCount} / ${r.sheet.pageCount}` : "—",
        },
        { key: "generatedAt", header: "Générée le", render: (r: OrderQueueRow) => fmtDate(r.sheet?.completedAt ?? null) },
        {
          key: "actions",
          header: "",
          render: (r: OrderQueueRow) => (
            <div className="flex items-center gap-3">
              {r.sheet?.downloadUrl && (
                <>
                  <a
                    href={r.sheet.downloadUrl}
                    download={`planche-${r.reference}.pdf`}
                    className="text-[13px] font-medium text-green-600 hover:underline"
                  >
                    Télécharger
                  </a>
                  <Button type="button" variant="link" className="text-green-600" onClick={() => setPreview(r)}>
                    Voir
                  </Button>
                </>
              )}
              {!isActive(r) && (
                <Button type="button" variant="link" className="text-slate-600" onClick={() => setTarget(r)}>
                  Regénérer
                </Button>
              )}
            </div>
          ),
        },
      ]
    : [
        ...common,
        {
          key: "actions",
          header: "",
          render: (r: OrderQueueRow) => (
            <Button type="button" onClick={() => setTarget(r)}>
              Générer
            </Button>
          ),
        },
      ];

  return (
    <Card>
      <CardBody className="px-0 py-0">
        {rows.length === 0 ? (
          <p className="px-6 py-6 text-center text-sm text-slate-400">
            {generated ? "Aucune planche générée." : "Aucune commande à traiter."}
          </p>
        ) : (
          <Table data={rows} keyExtractor={(r) => r.requestId} columns={columns} />
        )}
      </CardBody>
      {target && (
        <GenerateOrderSheetDialog
          row={target}
          layouts={layouts}
          regenerate={generated}
          onClose={() => setTarget(null)}
          onDone={done}
        />
      )}
      {preview?.sheet?.downloadUrl && (
        <Dialog open title={`Planche — ${preview.reference}`} onClose={() => setPreview(null)}>
          <iframe
            src={preview.sheet.downloadUrl}
            title="Aperçu de la planche"
            className="h-[60vh] w-full rounded-lg border border-slate-200"
          />
        </Dialog>
      )}
    </Card>
  );
}
