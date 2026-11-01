"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { CatPill } from "@/components/ui/Labels";
import { markInChunks, pollExport } from "@/lib/badge-batch-client";
import { ActionError, apiErrorMessage, toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { BadgeDocumentView } from "@/components/badge/BadgeDocumentView";
import { badgeDocumentUrl } from "@/lib/badge-document-client";

export type BatchBadge = {
  id: string;
  // Nom affiche, ou "Identité masquée" pour une categorie anonyme (calcule cote serveur).
  label: string;
  categoryName: string;
  categoryColor: string;
  printed: boolean;
};

// Rafraichissement de l'etat de l'export ZIP en cours.
const EXPORT_POLL_MS = 3000;

type ExportState =
  | { kind: "idle" }
  | { kind: "pending"; id: string; count: number }
  | { kind: "done"; fileKey: string }
  | { kind: "failed"; message: string };

// Impression par lot : liste des badges selectionnes, apercu HTML du badge choisi,
// export ZIP asynchrone (un PDF par badge, prepare par le worker, sans plafond),
// marquage explicite par paquets.
export function BadgeBatchPanel({
  orgId,
  eventId,
  archived,
  badges,
  ignored,
}: {
  orgId: string;
  eventId: string;
  archived: boolean;
  badges: BatchBadge[];
  ignored: number;
}) {
  const [currentId, setCurrentId] = useState<string | null>(badges[0]?.id ?? null);
  const [printedIds, setPrintedIds] = useState<Set<string>>(
    () => new Set(badges.filter((b) => b.printed).map((b) => b.id)),
  );

  const base = `/api/org/${orgId}/events/${eventId}`;
  const ids = badges.map((b) => b.id);
  const [exportState, setExportState] = useState<ExportState>({ kind: "idle" });

  const prepareZip = useAsyncAction(
    async () => {
      const res = await fetch(`${base}/badges/exports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw res;
      const json = await res.json();
      return json.export as { id: string; badgeCount: number | null };
    },
    {
      error: "La préparation du ZIP a échoué.",
      onSuccess: (exp) => setExportState({ kind: "pending", id: exp.id, count: exp.badgeCount ?? ids.length }),
    },
  );

  // Interroge l'export toutes les 3 s (requêtes jamais simultanées) tant qu'il est en préparation.
  const pendingId = exportState.kind === "pending" ? exportState.id : null;
  useEffect(() => {
    if (!pendingId) return;
    let cancelled = false;
    void pollExport({
      fetchStatus: () => fetch(`${base}/badges/exports/${pendingId}`),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      cancelled: () => cancelled,
      intervalMs: EXPORT_POLL_MS,
    }).then((outcome) => {
      if (outcome.kind === "done") setExportState({ kind: "done", fileKey: outcome.fileKey });
      else if (outcome.kind === "failed") setExportState({ kind: "failed", message: outcome.message });
    });
    return () => {
      cancelled = true;
    };
  }, [base, pendingId]);

  // Identifiants déjà marqués pendant cette session : un nouvel essai n'envoie que le reste
  // (la route renvoie les mails et notifications à chaque appel, elle n'est pas idempotente).
  const markedRef = useRef<Set<string>>(new Set());
  const markPrinted = useAsyncAction(
    async () => {
      const todo = ids.filter((id) => !markedRef.current.has(id));
      const result = await markInChunks(
        todo,
        (part) =>
          fetch(`${base}/registrations/print`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ids: part }),
          }),
        (part) => {
          part.forEach((id) => markedRef.current.add(id));
          setPrintedIds((prev) => new Set([...prev, ...part]));
        },
      );
      if (result.failure !== undefined) {
        const detail = await apiErrorMessage(result.failure, "erreur inattendue");
        throw new ActionError(
          `${result.markedIds.length} badge(s) marqué(s) imprimé(s) sur ${todo.length} ; le marquage s'est arrêté : ${detail}`,
        );
      }
      return result.printed;
    },
    {
      error: "Le marquage a échoué.",
      onSuccess: (count) => {
        toastSuccess(`${count} badge(s) marqué(s) imprimé(s).`);
      },
    },
  );

  return (
    <div className="space-y-4">
      {ignored > 0 && (
        <p className="text-[13px] text-amber-700">
          {ignored} identifiant(s) ignoré(s) : introuvables ou non approuvés.
        </p>
      )}

      {badges.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun badge à imprimer.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <Card>
            <CardHead title="Badges du lot" subtitle={`${badges.length} badge(s)`} />
            <CardBody className="space-y-3">
              <ul className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
                {badges.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setCurrentId(b.id)}
                      aria-current={b.id === currentId ? "true" : undefined}
                      className={`flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-[13px] ${
                        b.id === currentId ? "bg-slate-100" : "hover:bg-slate-50"
                      }`}
                    >
                      <span>
                        <span className="block font-medium text-slate-800">{b.label}</span>
                        <span className="block text-slate-400">N° {b.id}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <CatPill color={b.categoryColor} label={b.categoryName} />
                        {printedIds.has(b.id) && <span className="text-[11px] text-emerald-700">Imprimé</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2">
                {exportState.kind === "pending" ? (
                  <span role="status" className="inline-flex items-center px-3 py-2 text-[13px] text-slate-600">
                    Préparation… ({exportState.count} badges)
                  </span>
                ) : exportState.kind === "done" ? (
                  <a
                    href={`/api/files/${exportState.fileKey}`}
                    download
                    className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Télécharger le ZIP
                  </a>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void prepareZip.run()}
                    loading={prepareZip.pending}
                  >
                    Préparer le ZIP
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => void markPrinted.run()}
                  loading={markPrinted.pending}
                  disabled={archived}
                >
                  Marquer imprimés
                </Button>
              </div>
              {exportState.kind === "failed" && (
                <p role="alert" className="text-[13px] text-red-700">
                  {exportState.message}
                </p>
              )}
              {archived && (
                <p className="text-[13px] text-slate-500">Événement archivé : le marquage est désactivé.</p>
              )}
            </CardBody>
          </Card>

          {currentId && (
            <BadgeDocumentView src={badgeDocumentUrl(orgId, eventId, currentId)} label="Aperçu du badge" />
          )}
        </div>
      )}
    </div>
  );
}
