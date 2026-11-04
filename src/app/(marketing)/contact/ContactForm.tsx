"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { useAsyncAction } from "@/hooks/useAsyncAction";

const SUBJECTS = [
  "Demander une démo",
  "Question sur les tarifs",
  "Support technique",
  "Partenariat",
  "Autre",
];

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-navy focus:ring-1 focus:ring-navy";

export function ContactForm() {
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
  const canSubmit = emailValid && form.consent;

  // Succès : l'écran de remerciement tient lieu de retour (pas de toast).
  const send = useAsyncAction(
    async () => {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw res;
    },
    { error: "L'envoi a échoué.", onSuccess: () => setDone(true) },
  );
  const pending = send.pending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Validation côté client : inline, sans requête.
    if (!canSubmit) {
      setError("Renseignez un e-mail valide et acceptez la politique de confidentialité.");
      return;
    }
    void send.run();
  }

  if (done) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-turquoise-soft text-turquoise-strong">
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
          className="mt-0.5 h-4 w-4 accent-navy"
          checked={form.consent}
          onChange={(e) => set("consent", e.target.checked)}
        />
        <span>
          J&apos;accepte que mes données soient utilisées pour être recontacté, conformément à la{" "}
          <Link href="/confidentialite" className="font-medium text-navy hover:underline">
            politique de confidentialité
          </Link>
          .
        </span>
      </label>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <Button type="submit" loading={pending} disabled={!canSubmit} className="mt-5 w-full py-2.5">
        <span className="inline-flex items-center justify-center gap-2">
          Envoyer la demande <Icon name="send" size={16} />
        </span>
      </Button>
      <p className="mt-3 text-center text-xs text-slate-400">Réponse sous 1 jour ouvré · Aucune carte requise</p>
    </form>
  );
}
