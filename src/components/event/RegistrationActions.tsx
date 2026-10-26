"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ActionError } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";

type Reason = { id: string; label: string };

export function RegistrationActions({
  orgId,
  eventId,
  registrationId,
  status,
  badgePrinted,
  profileApproved,
  reasons,
  onChanged,
}: {
  orgId: string;
  eventId: string;
  registrationId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  badgePrinted: boolean;
  profileApproved: boolean;
  reasons: Reason[];
  onChanged: () => void;
}) {
  const [showReject, setShowReject] = useState(false);
  const [reasonId, setReasonId] = useState("");
  const [details, setDetails] = useState("");

  const base = `/api/org/${orgId}/events/${eventId}/registrations/${registrationId}`;

  const approve = useAsyncAction(
    async () => {
      const res = await fetch(`${base}/approve`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.error === "PROFILE_NOT_APPROVED") throw new ActionError("Profil non validé par la plateforme.");
        throw res;
      }
    },
    { success: "Inscription approuvée.", error: "Échec de l'approbation.", onSuccess: onChanged },
  );

  const reject = useAsyncAction(
    async () => {
      const res = await fetch(`${base}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reasonId, details: details || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.error === "REASON_WRONG_SCOPE") {
          throw new ActionError("Ce motif ne s'applique pas à une inscription.");
        }
        throw res;
      }
    },
    {
      success: "Inscription rejetée.",
      error: "Échec du rejet.",
      onSuccess: () => {
        setShowReject(false);
        onChanged();
      },
    },
  );

  const print = useAsyncAction(
    async () => {
      const res = await fetch(`${base}/print`, { method: "POST" });
      if (!res.ok) throw res;
    },
    { success: "Badge marqué imprimé.", error: "Échec du marquage.", onSuccess: onChanged },
  );
  // Les trois actions s'excluent.
  const busy = approve.pending || reject.pending || print.pending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "PENDING" && (
        <>
          <Button onClick={approve.run} loading={approve.pending} disabled={busy || !profileApproved} className="flex items-center gap-1.5">
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
      {status === "APPROVED" && badgePrinted && (
        <span className="text-xs text-slate-500">Badge imprimé : cette inscription ne peut plus être rejetée.</span>
      )}
      {status === "APPROVED" && (
        <Button onClick={print.run} loading={print.pending} disabled={busy} className="flex items-center gap-1.5">
          <Icon name="printer" size={16} /> Marquer imprimé
        </Button>
      )}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (reasonId) void reject.run();
            }}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
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
              <Button variant="danger" type="submit" loading={reject.pending} disabled={busy || !reasonId}>
                Rejeter
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
