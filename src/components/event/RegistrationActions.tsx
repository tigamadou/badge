"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

type Reason = { id: string; label: string };

export function RegistrationActions({
  orgId,
  eventId,
  registrationId,
  status,
  profileApproved,
  reasons,
  onChanged,
}: {
  orgId: string;
  eventId: string;
  registrationId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  profileApproved: boolean;
  reasons: Reason[];
  onChanged: () => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [reasonId, setReasonId] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/registrations/${registrationId}/approve`, {
      method: "POST",
    });
    setBusy(false);
    if (res.ok) {
      onChanged();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error === "PROFILE_NOT_APPROVED" ? "Profil non validé par la plateforme." : "Échec de l'approbation.");
    }
  }

  async function reject(e: React.FormEvent) {
    e.preventDefault();
    if (!reasonId) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/registrations/${registrationId}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reasonId, details: details || undefined }),
    });
    setBusy(false);
    if (res.ok) {
      setShowReject(false);
      onChanged();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(
        d.error === "REASON_WRONG_SCOPE"
          ? "Ce motif ne s'applique pas à une inscription."
          : "Échec du rejet.",
      );
    }
  }

  async function print() {
    setBusy(true);
    await fetch(`/api/org/${orgId}/events/${eventId}/registrations/${registrationId}/print`, { method: "POST" });
    setBusy(false);
    onChanged();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "PENDING" && (
        <>
          <Button onClick={approve} disabled={busy || !profileApproved} className="flex items-center gap-1.5">
            <Icon name="check" size={16} /> Approuver
          </Button>
          {!profileApproved && (
            <span className="text-xs text-amber-700">Profil non validé par la plateforme</span>
          )}
          <Button variant="danger" onClick={() => setShowReject(true)} disabled={busy} className="flex items-center gap-1.5">
            <Icon name="x" size={16} /> Rejeter / Bloquer
          </Button>
        </>
      )}
      {status === "APPROVED" && (
        <Button onClick={print} disabled={busy} className="flex items-center gap-1.5">
          <Icon name="printer" size={16} /> Marquer imprimé
        </Button>
      )}
      {error && <span className="w-full text-sm text-red-600">{error}</span>}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form onSubmit={reject} className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h3 className="text-base font-semibold text-slate-900">Rejeter cette inscription</h3>
            </div>
            <div className="space-y-3 px-6 py-5">
              <select
                required
                value={reasonId}
                onChange={(e) => setReasonId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Sélectionner un motif…</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <textarea
                maxLength={2000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Détails complémentaires (optionnel)"
                className="h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <Button variant="secondary" type="button" onClick={() => setShowReject(false)} disabled={busy}>
                Annuler
              </Button>
              <Button variant="danger" type="submit" disabled={busy || !reasonId}>
                Rejeter
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
