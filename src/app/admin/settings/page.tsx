"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Settings {
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
  contactEmail: string;
  contactPhone: string;
}

const defaultSettings: Settings = {
  smtpHost: "",
  smtpPort: 587,
  smtpFrom: "",
  smtpUser: "",
  smtpPassword: "",
  smtpSecure: false,
  contactEmail: "",
  contactPhone: "",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showTestForm, setShowTestForm] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setSettings({ ...defaultSettings, ...data });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleTestEmail() {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ success: true, message: "Email de test envoyé avec succès." });
      } else {
        setTestResult({ success: false, message: data.error || "Erreur lors de l'envoi." });
      }
    } catch {
      setTestResult({ success: false, message: "Erreur lors de l'envoi de l'email de test." });
    } finally {
      setTestLoading(false);
    }
  }

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-6">Paramètres</h1>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
        {/* Configuration SMTP */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Configuration SMTP</h2>

          <Input
            label="Serveur SMTP"
            value={settings.smtpHost}
            onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
            placeholder="smtp.example.com"
          />
          <Input
            label="Port SMTP"
            type="number"
            value={settings.smtpPort}
            onChange={(e) => setSettings({ ...settings, smtpPort: Number(e.target.value) })}
            placeholder="587"
          />
          <Input
            label="Adresse d'expédition"
            type="email"
            value={settings.smtpFrom}
            onChange={(e) => setSettings({ ...settings, smtpFrom: e.target.value })}
            placeholder="noreply@example.com"
          />
          <Input
            label="Utilisateur SMTP"
            value={settings.smtpUser}
            onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
            placeholder="user@example.com"
          />
          <Input
            label="Mot de passe SMTP"
            type="password"
            value={settings.smtpPassword}
            onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
            placeholder="••••••••"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.smtpSecure}
              onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm">Connexion sécurisée (TLS)</span>
          </label>

          <div className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowTestForm(!showTestForm); setTestResult(null); }}
            >
              Tester la configuration
            </Button>

            {showTestForm && (
              <div className="mt-3 flex items-end gap-3">
                <div className="flex-1">
                  <Input
                    label="Email de test"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testLoading || !testEmail}
                >
                  {testLoading ? "Envoi..." : "Envoyer le test"}
                </Button>
              </div>
            )}

            {testResult && (
              <p className={`mt-2 text-sm ${testResult.success ? "text-emerald-600" : "text-rose-600"}`}>
                {testResult.message}
              </p>
            )}
          </div>
        </div>

        {/* Informations de contact */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Informations de contact</h2>

          <Input
            label="Email de contact"
            type="email"
            value={settings.contactEmail}
            onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
            placeholder="contact@example.com"
          />
          <Input
            label="Téléphone de contact"
            type="tel"
            value={settings.contactPhone}
            onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
            placeholder="+229 97 00 00 00"
          />
          <p className="text-sm text-slate-500">
            Ces informations seront incluses dans les emails envoyés aux inscrits.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
          {saved && (
            <span className="text-sm text-emerald-600">Modifications enregistrées.</span>
          )}
        </div>
      </form>
    </div>
  );
}
