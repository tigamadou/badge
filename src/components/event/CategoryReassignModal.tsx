"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Cat = { id: string; name: string; number: number };

export function CategoryReassignModal({
  orgId,
  eventId,
  fromCategory,
  candidates,
  onDone,
  onCancel,
}: {
  orgId: string;
  eventId: string;
  fromCategory: Cat;
  candidates: Cat[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [target, setTarget] = useState<string>(candidates[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/${orgId}/events/${eventId}/categories/${fromCategory.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reassignToCategoryId: target }),
    });
    if (!res.ok) {
      setErr("Échec de la réaffectation.");
      setBusy(false);
      return;
    }
    const del = await fetch(`/api/admin/${orgId}/events/${eventId}/categories/${fromCategory.id}`, {
      method: "DELETE",
    });
    if (!del.ok) {
      setErr("Réaffectation OK mais suppression refusée.");
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20">
      <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-3">
        <h3 className="font-semibold">Réaffecter les inscriptions de « {fromCategory.name} »</h3>
        {err && <div className="text-sm text-red-600">{err}</div>}
        {candidates.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune autre catégorie disponible. Créez-en une d&apos;abord.</p>
        ) : (
          <>
            <label className="text-sm block">Vers :</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.number} — {c.name}
                </option>
              ))}
            </select>
          </>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy || candidates.length === 0}>
            {busy ? "..." : "Réaffecter et supprimer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
