"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PublicSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
  smtpUser: string;
  smtpSecure: boolean;
  smtpPasswordSet: boolean;
  recaptchaEnabled: boolean;
  recaptchaSiteKey: string;
  recaptchaSecretKeySet: boolean;
};

export function PlatformSettingsForm({
  initial,
  canEditSecrets = false,
}: {
  initial: PublicSettings;
  /**
   * ADR 2026-06-01 : smtpPassword et recaptchaSecretKey sont editables uniquement
   * par SUPER_ADMIN. Pour les autres roles staff, les champs sont desactives et
   * un avertissement est affiche.
   */
  canEditSecrets?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    smtpHost: initial.smtpHost,
    smtpPort: String(initial.smtpPort),
    smtpFrom: initial.smtpFrom,
    smtpUser: initial.smtpUser,
    smtpPassword: "",
    smtpSecure: initial.smtpSecure,
    recaptchaEnabled: initial.recaptchaEnabled,
    recaptchaSiteKey: initial.recaptchaSiteKey,
    recaptchaSecretKey: "",
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    const payload: Record<string, unknown> = {
      smtpHost: form.smtpHost,
      smtpPort: Number(form.smtpPort) || 587,
      smtpFrom: form.smtpFrom,
      smtpUser: form.smtpUser,
      smtpSecure: form.smtpSecure,
      recaptchaEnabled: form.recaptchaEnabled,
      recaptchaSiteKey: form.recaptchaSiteKey,
    };
    // Champs secrets : on n'envoie que si l'admin a saisi une nouvelle valeur,
    // pour conserver l'ancienne valeur cote serveur.
    if (form.smtpPassword) payload.smtpPassword = form.smtpPassword;
    if (form.recaptchaSecretKey) payload.recaptchaSecretKey = form.recaptchaSecretKey;

    const res = await fetch("/api/staff/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Parametres enregistres.");
      // Reset les champs secrets pour eviter de re-soumettre la meme valeur.
      setForm((f) => ({ ...f, smtpPassword: "", recaptchaSecretKey: "" }));
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setMsg(
        `Echec de l'enregistrement (${res.status}). ${body.error ?? ""}`.trim(),
      );
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {!canEditSecrets && (
        <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          Les champs <strong>Mot de passe SMTP</strong> et{" "}
          <strong>Secret key reCAPTCHA</strong> sont reserves au role
          SUPER_ADMIN. Vous pouvez modifier les autres parametres normalement.
        </div>
      )}
      {msg && (
        <div className="rounded bg-blue-50 border border-blue-200 px-3 py-2 text-sm">
          {msg}
        </div>
      )}

      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">SMTP</h2>
        <Field
          label="Hote SMTP"
          value={form.smtpHost}
          onChange={(v) => setForm((f) => ({ ...f, smtpHost: v }))}
        />
        <Field
          label="Port"
          type="number"
          value={form.smtpPort}
          onChange={(v) => setForm((f) => ({ ...f, smtpPort: v }))}
        />
        <Field
          label="Expediteur (From)"
          type="email"
          value={form.smtpFrom}
          onChange={(v) => setForm((f) => ({ ...f, smtpFrom: v }))}
        />
        <Field
          label="Utilisateur SMTP"
          value={form.smtpUser}
          onChange={(v) => setForm((f) => ({ ...f, smtpUser: v }))}
        />
        <Field
          label={`Mot de passe SMTP ${
            initial.smtpPasswordSet ? "(rempli — saisir pour remplacer)" : ""
          }${canEditSecrets ? "" : " (reserve SUPER_ADMIN)"}`}
          type={showSecrets ? "text" : "password"}
          value={form.smtpPassword}
          onChange={(v) => setForm((f) => ({ ...f, smtpPassword: v }))}
          disabled={!canEditSecrets}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.smtpSecure}
            onChange={(e) =>
              setForm((f) => ({ ...f, smtpSecure: e.target.checked }))
            }
          />
          TLS (smtpSecure)
        </label>
      </section>

      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">reCAPTCHA</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.recaptchaEnabled}
            onChange={(e) =>
              setForm((f) => ({ ...f, recaptchaEnabled: e.target.checked }))
            }
          />
          Active par defaut
        </label>
        <Field
          label="Site key"
          value={form.recaptchaSiteKey}
          onChange={(v) => setForm((f) => ({ ...f, recaptchaSiteKey: v }))}
        />
        <Field
          label={`Secret key ${
            initial.recaptchaSecretKeySet ? "(rempli — saisir pour remplacer)" : ""
          }${canEditSecrets ? "" : " (reserve SUPER_ADMIN)"}`}
          type={showSecrets ? "text" : "password"}
          value={form.recaptchaSecretKey}
          onChange={(v) => setForm((f) => ({ ...f, recaptchaSecretKey: v }))}
          disabled={!canEditSecrets}
        />
      </section>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showSecrets}
          onChange={(e) => setShowSecrets(e.target.checked)}
        />
        Afficher les valeurs masquees pendant la saisie
      </label>

      <button
        onClick={save}
        disabled={busy}
        className="rounded bg-blue-600 text-white px-3 py-1.5 text-sm disabled:bg-slate-300"
      >
        {busy ? "Enregistrement..." : "Enregistrer les parametres"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded border px-3 py-1.5 text-sm disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}
