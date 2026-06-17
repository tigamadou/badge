"use client";

import { useState } from "react";

export function TestSmtpForm({ defaultEmail }: { defaultEmail?: string }) {
  const [to, setTo] = useState(defaultEmail ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/staff/settings/test-smtp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(to ? { to } : {}),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg(`Email de test envoye a ${body.to}.`);
    } else {
      setMsg(`Echec : ${body.message ?? body.error ?? "erreur inconnue"}`);
    }
  }

  return (
    <section className="bg-white border rounded p-4 space-y-3 max-w-2xl">
      <h2 className="font-semibold">Tester l&apos;envoi SMTP</h2>
      <label className="block">
        <span className="text-sm text-slate-600">
          Destinataire (par defaut : votre email)
        </span>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
          placeholder="moi@example.com"
        />
      </label>
      <button
        onClick={run}
        disabled={busy}
        className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? "Envoi..." : "Envoyer un email de test"}
      </button>
      {msg && <div className="text-sm">{msg}</div>}
    </section>
  );
}
