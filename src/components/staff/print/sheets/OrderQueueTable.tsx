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
import { GenerationStatePill } from "@/components/staff/print/sheets/GenerationStatePill";
import { detectTransitions } from "@/components/staff/print/sheets/transitions";
import { toastError, toastSuccess } from "@/lib/toast";

export const ORDER_REFRESH_INTERVAL_MS = 5000;

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");

const isActive = (r: OrderQueueRow) => r.sheet?.status === "PENDING" || r.sheet?.status === "RUNNING";

// File des commandes : « À traiter » (génération) ou « Générées » (état, téléchargement, regénération).
export function OrderQueueTable({
  mode,
  initial,
  layouts,
  canGenerate,
}: {
  mode: "pending" | "generated";
  initial: OrderQueueRow[];
  layouts: LayoutOption[];
  canGenerate: boolean;
}) {
  const router = useRouter();
  // Lignes rafraîchies par polling, valables tant que les données serveur n'ont pas changé.
  const [polled, setPolled] = useState<{ from: OrderQueueRow[]; rows: OrderQueueRow[] } | null>(null);
  const rows = polled && polled.from === initial ? polled.rows : initial;
  const [target, setTarget] = useState<OrderQueueRow | null>(null);
  const [preview, setPreview] = useState<OrderQueueRow | null>(null);
  const inFlight = useRef(false);
  const generated = mode === "generated";
  const active = rows.some(isActive);
  // Lignes affichées au dernier rendu : sert à repérer les planches qui viennent de se terminer.
  const shown = useRef(rows);
  useEffect(() => {
    shown.current = rows;
  });

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/platform/print/sheets/orders");
      if (res.ok) {
        // L'API renvoie la file complete : seules les lignes de la page affichee sont mises a jour.
        const fresh = (await res.json()).orders as OrderQueueRow[];
        const next = mergeRows(shown.current, fresh, (r) => r.requestId);
        const { ready, failed } = detectTransitions(shown.current, next);
        setPolled({ from: initial, rows: next });
        for (const r of ready) toastSuccess(`Planche de ${r.reference} prête`);
        for (const r of failed) toastError(`La génération de la planche de ${r.reference} a échoué`);
        // En « À traiter », une planche terminée sort de la file : relecture de la tranche serveur.
        if (ready.length > 0 && mode === "pending") router.refresh();
      }
    } catch {
      // Réseau coupé : le prochain tick réessaie.
    } finally {
      inFlight.current = false;
    }
  }, [initial, mode, router]);

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
        <Link href={`/platform/print/orders/${r.requestId}`} className="font-medium text-navy hover:underline">
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

  const stateColumn = {
    key: "state",
    header: "État",
    render: (r: OrderQueueRow) =>
      r.sheet && <GenerationStatePill status={r.sheet.status} doneLabel="Prête" error={r.sheet.error} />,
  };

  const actionsColumn = {
    key: "actions",
    header: "",
    render: (r: OrderQueueRow) => (
      <div className="flex items-center gap-3">
        {generated && r.sheet?.downloadUrl && (
          <>
            <a
              href={r.sheet.downloadUrl}
              download={`planche-${r.reference}.pdf`}
              className="text-[13px] font-medium text-navy hover:underline"
            >
              Télécharger
            </a>
            <Button type="button" variant="link" className="text-navy" onClick={() => setPreview(r)}>
              Voir
            </Button>
          </>
        )}
        {canGenerate && (
          <Button
            type="button"
            variant={r.sheet ? "link" : "primary"}
            className={r.sheet ? "text-slate-600" : undefined}
            disabled={isActive(r)}
            onClick={() => setTarget(r)}
          >
            {r.sheet ? "Regénérer" : "Générer"}
          </Button>
        )}
      </div>
    ),
  };

  const columns = generated
    ? [
        ...common,
        stateColumn,
        { key: "layout", header: "Gabarit", render: (r: OrderQueueRow) => r.sheet?.layoutName ?? "—" },
        {
          key: "pages",
          header: "Feuilles / pages",
          render: (r: OrderQueueRow) =>
            r.sheet?.sheetCount != null ? `${r.sheet.sheetCount} / ${r.sheet.pageCount}` : "—",
        },
        { key: "generatedAt", header: "Générée le", render: (r: OrderQueueRow) => fmtDate(r.sheet?.completedAt ?? null) },
        actionsColumn,
      ]
    : [...common, stateColumn, actionsColumn];

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
          regenerate={target.sheet !== null}
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
