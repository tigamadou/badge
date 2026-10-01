"use client";

import { useState } from "react";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { CatPill } from "@/components/ui/Labels";
import { MAX_BADGES_PER_BATCH } from "@/lib/badge-batch";

export type BatchBadge = {
  id: string;
  // Nom affiche, ou "Identité masquée" pour une categorie anonyme (calcule cote serveur).
  label: string;
  categoryName: string;
  categoryColor: string;
  printed: boolean;
};

// Impression par lot : liste des badges selectionnes, apercu du PDF serveur du
// badge choisi, ZIP d'un PDF par badge pour l'imprimante a badges, marquage explicite.
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const base = `/api/org/${orgId}/events/${eventId}`;
  const ids = badges.map((b) => b.id);
  const tooMany = badges.length > MAX_BADGES_PER_BATCH;

  async function markPrinted() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${base}/registrations/print`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        setMessage("Le marquage a échoué.");
        return;
      }
      const json = await res.json();
      setPrintedIds(new Set(ids));
      setMessage(`${json.printed} badge(s) marqué(s) imprimé(s).`);
    } catch {
      setMessage("Le marquage a échoué.");
    } finally {
      setBusy(false);
    }
  }

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
                {tooMany ? (
                  <p className="text-[13px] text-amber-700">
                    Un lot compte au plus {MAX_BADGES_PER_BATCH} badges : réduisez la sélection.
                  </p>
                ) : (
                  <a
                    href={`${base}/badges/print-zip?ids=${encodeURIComponent(ids.join(","))}`}
                    className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Télécharger le lot (.zip)
                  </a>
                )}
                <button
                  type="button"
                  onClick={markPrinted}
                  disabled={archived || busy}
                  className="inline-flex items-center rounded-lg bg-green-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Marquer imprimés
                </button>
              </div>
              {archived && (
                <p className="text-[13px] text-slate-500">Événement archivé : le marquage est désactivé.</p>
              )}
              {message && <p className="text-[13px] text-slate-600">{message}</p>}
            </CardBody>
          </Card>

          {currentId && (
            <iframe
              title="Aperçu du badge"
              src={`${base}/badges/${currentId}`}
              className="h-[640px] w-full rounded-xl border border-slate-200 bg-white"
            />
          )}
        </div>
      )}
    </div>
  );
}
