"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

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
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${registrationId}/approve`, { method: "POST" });
    setBusy(false);
    onChanged();
  }

  async function reject(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${registrationId}/reject`, {
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
    await fetch(`/api/admin/${orgId}/events/${eventId}/registrations/${registrationId}/print`, { method: "POST" });
    setBusy(false);
    onChanged();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "PENDING" && (
        <>
          <Button onClick={approve} disabled={busy}>
            Approuver
          </Button>
          <Button variant="secondary" onClick={() => setShowReject(true)} disabled={busy}>
            Rejeter
          </Button>
        </>
      )}
      {status === "APPROVED" && (
        <Button onClick={print} disabled={busy}>
          Marquer imprimé
        </Button>
      )}
      {showReject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-20">
          <form onSubmit={reject} className="bg-white rounded-lg p-6 max-w-md w-full space-y-3">
            <h3 className="font-semibold">Rejeter cette inscription</h3>
            <input
              type="text"
              required
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motif (obligatoire)"
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <textarea
              maxLength={2000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Détails complémentaires (optionnel)"
              className="w-full border rounded px-2 py-1 text-sm h-24"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" type="button" onClick={() => setShowReject(false)} disabled={busy}>
                Annuler
              </Button>
              <Button type="submit" disabled={busy || !reason}>
                Rejeter
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
