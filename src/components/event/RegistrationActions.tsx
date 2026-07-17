"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function RegistrationActions({
  orgId,
  eventId,
  registrationId,
  status,
  onChanged,
}: {
  orgId: string;
  eventId: string;
  registrationId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  onChanged: () => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    await fetch(`/api/org/${orgId}/events/${eventId}/registrations/${registrationId}/approve`, { method: "POST" });
    setBusy(false);
    onChanged();
  }

  async function reject(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    await fetch(`/api/org/${orgId}/events/${eventId}/registrations/${registrationId}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason, details: details || undefined }),
    });
    setBusy(false);
    setShowReject(false);
    onChanged();
  }

  async function print() {
    setBusy(true);
    await fetch(`/api/org/${orgId}/events/${eventId}/registrations/${registrationId}/print`, { method: "POST" });
    setBusy(false);
    onChanged();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "PENDING" && (
        <>
          <Button onClick={approve} disabled={busy} className="flex items-center gap-1.5">
            <Icon name="check" size={16} /> Approuver
          </Button>
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
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form onSubmit={reject} className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h3 className="text-base font-semibold text-slate-900">Rejeter cette inscription</h3>
            </div>
            <div className="space-y-3 px-6 py-5">
              <input
                type="text"
                required
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motif (obligatoire)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
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
              <Button variant="danger" type="submit" disabled={busy || !reason}>
                Rejeter
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
