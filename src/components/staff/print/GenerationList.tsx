"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardBody, CardHead } from "@/components/ui/Card";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import { Button } from "@/components/ui/Button";
import { Table } from "@/components/ui/Table";

export type GenerationStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export type GenerationRow = {
  id: string;
  status: GenerationStatus;
  duplex: boolean;
  badgeCount: number;
  sheetCount: number | null;
  skippedIds: unknown;
  error: string | null;
  createdAt: string;
  event: { id: string; title: string };
  layout: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
};

export const REFRESH_INTERVAL_MS = 5000;

const STATUS: Record<GenerationStatus, { label: string; className: string }> = {
  PENDING: { label: "En attente", className: "bg-amber-50 text-amber-700" },
  RUNNING: { label: "En cours", className: "bg-sky-50 text-sky-700" },
  DONE: { label: "Terminée", className: "bg-emerald-50 text-emerald-700" },
  FAILED: { label: "Échec", className: "bg-rose-50 text-rose-700" },
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

const fileKey = (id: string) => `print-sheets/${id}.pdf`;

const skippedOf = (g: GenerationRow): string[] =>
  Array.isArray(g.skippedIds) ? g.skippedIds.filter((x): x is string => typeof x === "string") : [];

export const isActive = (g: { status: GenerationStatus }) => g.status === "PENDING" || g.status === "RUNNING";

export function GenerationList({
  generations,
  onChange,
}: {
  generations: GenerationRow[];
  onChange: (rows: GenerationRow[]) => void;
}) {
  // nonce : chaque clic sur « Aperçu » remonte le composant, donc rouvre l'aperçu fermé.
  const [previewState, setPreviewState] = useState<{ id: string; nonce: number } | null>(null);
  const previewId = previewState?.id ?? null;
  const inFlight = useRef(false);
  const active = generations.some(isActive);
  // Dernière version de onChange sans relancer le minuteur à chaque rendu.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Rafraîchit toutes les 5 s tant qu'une ligne est en attente ou en cours, onglet visible.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    async function refresh() {
      // Une seule requête à la fois : une réponse lente ne chevauche pas le tick suivant.
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const res = await fetch("/api/platform/print/sheets");
        if (res.ok && !cancelled) onChangeRef.current((await res.json()).generations);
      } catch {
        // Réseau coupé : le prochain tick réessaie.
      } finally {
        inFlight.current = false;
      }
    }
    function start() {
      if (timer === undefined && document.visibilityState === "visible") {
        timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
      }
    }
    function stop() {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      } else {
        stop();
      }
    }
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active]);

  const preview = generations.find((g) => g.id === previewId && g.status === "DONE");

  return (
    <Card>
      <CardHead title="Historique" subtitle="Les 50 dernières générations de planches." />
      <CardBody className="px-0 py-0">
        {generations.length === 0 ? (
          <p className="px-6 py-6 text-center text-sm text-slate-400">Aucune génération.</p>
        ) : (
          <Table
            data={generations}
            keyExtractor={(g) => g.id}
            columns={[
              { key: "date", header: "Date", render: (g) => dateFmt.format(new Date(g.createdAt)) },
              { key: "event", header: "Évènement", render: (g) => g.event.title },
              { key: "layout", header: "Gabarit", render: (g) => g.layout?.name ?? "—" },
              { key: "badges", header: "Badges", render: (g) => g.badgeCount },
              { key: "sheets", header: "Feuilles", render: (g) => g.sheetCount ?? "—" },
              {
                key: "status",
                header: "Statut",
                render: (g) => (
                  <div className="space-y-1">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS[g.status].className}`}>
                      {STATUS[g.status].label}
                    </span>
                    {g.status === "FAILED" && (
                      <p className="text-xs text-rose-600">{g.error ?? "Erreur inconnue."}</p>
                    )}
                    {skippedOf(g).length > 0 && (
                      <details className="text-xs text-amber-700">
                        <summary className="cursor-pointer">
                          {skippedOf(g).length} badge{skippedOf(g).length > 1 ? "s" : ""} écarté
                          {skippedOf(g).length > 1 ? "s" : ""}
                        </summary>
                        <p className="mt-1 break-all">{skippedOf(g).join(", ")}</p>
                      </details>
                    )}
                  </div>
                ),
              },
              { key: "author", header: "Auteur", render: (g) => g.createdBy?.name ?? "—" },
              {
                key: "actions",
                header: "",
                render: (g) =>
                  g.status === "DONE" ? (
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="link" className="text-green-600" onClick={() => setPreviewState((p) => ({ id: g.id, nonce: (p?.nonce ?? 0) + 1 }))}>
                        Aperçu
                      </Button>
                      <a
                        href={`/api/files/${fileKey(g.id)}`}
                        download={`planches-${g.id}.pdf`}
                        className="text-[13px] font-medium text-green-600 hover:underline"
                      >
                        Télécharger
                      </a>
                    </div>
                  ) : null,
              },
            ]}
          />
        )}
      </CardBody>
      {preview && (
        <CardBody className="border-t border-slate-100">
          {/* key : une nouvelle ligne rouvre l'aperçu, la fermeture le laisse dans la carte. */}
          <DocumentPreview
            key={`${preview.id}-${previewState?.nonce}`}
            storageKey={fileKey(preview.id)}
            label={`Planches — ${preview.event.title}`}
            defaultOpen
          />
        </CardBody>
      )}
    </Card>
  );
}
