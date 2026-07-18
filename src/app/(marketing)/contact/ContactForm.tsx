"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

const SUBJECTS = [
  "Demander une démo",
  "Question sur les tarifs",
  "Support technique",
  "Partenariat",
  "Autre",
];

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600";

export function ContactForm() {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    organization: "",
    subject: SUBJECTS[0],
    message: "",
    consent: false,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const canSubmit = emailValid && form.consent && !pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError("Renseignez un e-mail valide et acceptez la politique de confidentialité.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "L'envoi a échoué.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "L'envoi a échoué.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-green-600">
          <Icon name="check-circle" size={30} />
        </span>
        <h3 className="text-lg font-semibold text-slate-900">Demande envoyée</h3>
        <p className="mt-2 max-w-[320px] text-sm text-slate-500">
          Merci ! Notre équipe vous répond sous un jour ouvré.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="p-1">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Prénom</label>
          <input className={inputClass} placeholder="Camille" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nom</label>
          <input className={inputClass} placeholder="Fabre" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </div>
      </div>
      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          E-mail professionnel <span className="text-rose-600">*</span>
        </label>
        <input
          type="email"
          className={inputClass}
          placeholder="vous@organisation.fr"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </div>
      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Organisation</label>
        <input className={inputClass} placeholder="Nom de votre organisation" value={form.organization} onChange={(e) => set("organization", e.target.value)} />
      </div>
      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Sujet</label>
        <div className="relative">
          <select
            className={`${inputClass} cursor-pointer appearance-none pr-9`}
            value={form.subject}
            onChange={(e) => set("subject", e.target.value)}
          >
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="chevron-down" size={16} />
          </span>
        </div>
      </div>
      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
        <textarea
          className={`${inputClass} min-h-[84px] resize-y leading-relaxed`}
          placeholder="Décrivez votre besoin, le type d'événement et le volume attendu."
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
        />
      </div>
      <label className="mt-4 flex items-start gap-2.5 text-sm text-slate-600">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-green-600"
          checked={form.consent}
          onChange={(e) => set("consent", e.target.checked)}
        />
        <span>
          J&apos;accepte que mes données soient utilisées pour être recontacté, conformément à la{" "}
          <Link href="/confidentialite" className="font-medium text-green-600 hover:underline">
            politique de confidentialité
          </Link>
          .
        </span>
      </label>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Envoi…" : "Envoyer la demande"} <Icon name="send" size={16} />
      </button>
      <p className="mt-3 text-center text-xs text-slate-400">Réponse sous 1 jour ouvré · Aucune carte requise</p>
    </form>
  );
}
