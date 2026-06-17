"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  name: string;
  slug: string;
  quotaMaxEvents: string;
  quotaMaxRegistrations: string;
  quotaMaxStorageMB: string;
  ownerEmail: string;
  ownerName: string;
};

const INITIAL_FORM: FormState = {
  name: "",
  slug: "",
  quotaMaxEvents: "",
  quotaMaxRegistrations: "",
  quotaMaxStorageMB: "",
  ownerEmail: "",
  ownerName: "",
};

export function OrgCreationForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      ownerEmail: form.ownerEmail.trim(),
    };
    if (form.ownerName.trim()) payload.ownerName = form.ownerName.trim();
    if (form.slug.trim()) payload.slug = form.slug.trim();
    if (form.quotaMaxEvents) payload.quotaMaxEvents = Number(form.quotaMaxEvents);
    if (form.quotaMaxRegistrations)
      payload.quotaMaxRegistrations = Number(form.quotaMaxRegistrations);
    if (form.quotaMaxStorageMB)
      payload.quotaMaxStorageMB = Number(form.quotaMaxStorageMB);

    const res = await fetch("/api/staff/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (res.ok) {
      const json = await res.json();
      router.push(`/staff/organizations/${json.org.id}`);
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erreur a la creation.");
    }
  }

  const canSubmit =
    form.name.trim() && form.ownerEmail.trim() && !submitting;

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      {error && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Organisation</h2>
        <Field
          label="Nom de l'organisation"
          value={form.name}
          onChange={(v) => set("name", v)}
          required
        />
        <Field
          label="Slug (optionnel — genere depuis le nom si vide)"
          value={form.slug}
          onChange={(v) => set("slug", v)}
          placeholder="acme-corp"
        />
        <Field
          label="Quota max events (optionnel)"
          type="number"
          value={form.quotaMaxEvents}
          onChange={(v) => set("quotaMaxEvents", v)}
        />
        <Field
          label="Quota max inscriptions (optionnel)"
          type="number"
          value={form.quotaMaxRegistrations}
          onChange={(v) => set("quotaMaxRegistrations", v)}
        />
        <Field
          label="Quota max stockage Mo (optionnel)"
          type="number"
          value={form.quotaMaxStorageMB}
          onChange={(v) => set("quotaMaxStorageMB", v)}
        />
      </div>

      <div className="bg-white border rounded p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">OWNER initial</h2>
        <p className="text-sm text-slate-600">
          Un utilisateur sera cree (s&apos;il n&apos;existe pas) et un email
          d&apos;invitation lui sera envoye pour definir son mot de passe.
        </p>
        <Field
          label="Email du OWNER"
          type="email"
          value={form.ownerEmail}
          onChange={(v) => set("ownerEmail", v)}
          required
        />
        <Field
          label="Nom complet du OWNER (optionnel)"
          value={form.ownerName}
          onChange={(v) => set("ownerName", v)}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm disabled:bg-slate-300"
        >
          {submitting ? "Creation..." : "Creer l'organisation"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border px-3 py-1.5 text-sm"
      />
    </label>
  );
}
