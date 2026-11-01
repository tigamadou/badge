"use client";

import { useEffect, useState } from "react";
import { BadgeBatchPanel, type BatchBadge } from "@/components/event/BadgeBatchPanel";
import { readSelection } from "@/lib/badge-batch-client";

type Loaded =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "ready"; badges: BatchBadge[]; ignored: number };

// Impression par lot : relit la sélection rangée dans sessionStorage (clé `?sel=`), charge les
// lignes à afficher par POST /badges/batch (ids dans le corps, sans plafond), puis affiche le panneau.
export function BadgeBatchLoader({
  orgId,
  eventId,
  archived,
  selectionKey,
}: {
  orgId: string;
  eventId: string;
  archived: boolean;
  selectionKey: string | null;
}) {
  const [state, setState] = useState<Loaded>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const ids = readSelection(window.sessionStorage, selectionKey);
    if (!ids) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ kind: "missing" });
      return;
    }
    setState({ kind: "loading" });
    fetch(`/api/org/${orgId}/events/${eventId}/badges/batch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { badges: BatchBadge[]; ignored: number };
        if (!cancelled) setState({ kind: "ready", badges: json.badges, ignored: json.ignored });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, eventId, selectionKey]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Impression par lot</h1>
        {state.kind === "ready" && (
          <p className="mt-0.5 text-sm text-slate-400">{state.badges.length} badge(s) à imprimer</p>
        )}
      </div>
      {state.kind === "loading" && <p className="text-sm text-slate-500">Chargement de la sélection…</p>}
      {state.kind === "missing" && (
        <p role="alert" className="text-sm text-slate-600">
          Sélection introuvable : revenez à la liste des badges.
        </p>
      )}
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-red-700">
          Le chargement de la sélection a échoué. Rechargez la page.
        </p>
      )}
      {state.kind === "ready" && (
        <BadgeBatchPanel
          orgId={orgId}
          eventId={eventId}
          archived={archived}
          badges={state.badges}
          ignored={state.ignored}
          selectionKey={selectionKey as string}
        />
      )}
    </div>
  );
}
