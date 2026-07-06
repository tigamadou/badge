"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardHead, CardBody } from "@/components/ui/Card";
import { Switch } from "@/components/ui/FormControls";
import { Alert, Spinner } from "@/components/ui/Feedback";

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
      setMsg("Paramètres enregistrés.");
      // Reset les champs secrets pour eviter de re-soumettre la meme valeur.
      setForm((f) => ({ ...f, smtpPassword: "", recaptchaSecretKey: "" }));
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setMsg(`Échec de l'enregistrement (${res.status}). ${body.error ?? ""}`.trim());
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {!canEditSecrets && (
        <Alert tone="warn">
          Les champs <strong>Mot de passe SMTP</strong> et <strong>Secret key reCAPTCHA</strong> sont réservés au rôle
          SUPER_ADMIN. Vous pouvez modifier les autres paramètres normalement.
        </Alert>
      )}
      {msg && <Alert tone="info">{msg}</Alert>}

      <Card>
        <CardHead title="Serveur SMTP" subtitle="Configuration d'envoi des e-mails de la plateforme." />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Hôte SMTP" value={form.smtpHost} onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))} />
            <Input label="Port" type="number" value={form.smtpPort} onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))} />
          </div>
          <Input label="Expéditeur (From)" type="email" value={form.smtpFrom} onChange={(e) => setForm((f) => ({ ...f, smtpFrom: e.target.value }))} />
          <Input label="Utilisateur SMTP" value={form.smtpUser} onChange={(e) => setForm((f) => ({ ...f, smtpUser: e.target.value }))} />
          <Input
            label={`Mot de passe SMTP ${initial.smtpPasswordSet ? "(rempli — saisir pour remplacer)" : ""}${canEditSecrets ? "" : " (réservé SUPER_ADMIN)"}`}
            type={showSecrets ? "text" : "password"}
            value={form.smtpPassword}
            onChange={(e) => setForm((f) => ({ ...f, smtpPassword: e.target.value }))}
            disabled={!canEditSecrets}
          />
          <Switch checked={form.smtpSecure} onChange={(v) => setForm((f) => ({ ...f, smtpSecure: v }))} label="TLS (connexion sécurisée)" />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="reCAPTCHA" subtitle="Protection anti-spam des formulaires publics." />
        <CardBody className="space-y-4">
          <Switch
            checked={form.recaptchaEnabled}
            onChange={(v) => setForm((f) => ({ ...f, recaptchaEnabled: v }))}
            label="Activé par défaut"
          />
          <Input label="Site key" value={form.recaptchaSiteKey} onChange={(e) => setForm((f) => ({ ...f, recaptchaSiteKey: e.target.value }))} />
          <Input
            label={`Secret key ${initial.recaptchaSecretKeySet ? "(rempli — saisir pour remplacer)" : ""}${canEditSecrets ? "" : " (réservé SUPER_ADMIN)"}`}
            type={showSecrets ? "text" : "password"}
            value={form.recaptchaSecretKey}
            onChange={(e) => setForm((f) => ({ ...f, recaptchaSecretKey: e.target.value }))}
            disabled={!canEditSecrets}
          />
        </CardBody>
      </Card>

      <Switch checked={showSecrets} onChange={setShowSecrets} label="Afficher les valeurs masquées pendant la saisie" />

      <div className="flex justify-end">
        <Button onClick={save} className="flex items-center justify-center gap-2" disabled={busy}>
          {busy ? (
            <>
              <Spinner size={16} /> Enregistrement…
            </>
          ) : (
            "Enregistrer les paramètres"
          )}
        </Button>
      </div>
    </div>
  );
}
