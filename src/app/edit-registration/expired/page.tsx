"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function ExpiredContent() {
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const reason = sp.get("reason") ?? "EXPIRED";
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function resend() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/edit-registration/${token}/resend`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.code === "COOLDOWN") setError("Patientez 1 minute avant de réessayer.");
        else throw new Error(j.code || `HTTP ${res.status}`);
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-6 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">
        {reason === "NOT_FOUND" ? "Lien introuvable" : "Lien expiré"}
      </h1>
      <p className="mt-2 text-sm text-neutral-700">
        {reason === "NOT_FOUND"
          ? "Ce lien d'édition n'existe pas (ou plus)."
          : "Ce lien d'édition n'est plus valide. Vous pouvez en demander un nouveau."}
      </p>
      {token && reason !== "NOT_FOUND" && (
        <button
          onClick={resend}
          disabled={loading || sent}
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {sent ? "Demande envoyée" : loading ? "Envoi…" : "Demander un nouveau lien"}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function ExpiredPage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <Suspense fallback={<div className="rounded-lg border bg-white p-6 text-center text-sm text-neutral-500">Chargement…</div>}>
        <ExpiredContent />
      </Suspense>
    </main>
  );
}
