"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormSection } from "@/components/ui/FormControls";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

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
    if (form.quotaMaxRegistrations) payload.quotaMaxRegistrations = Number(form.quotaMaxRegistrations);
    if (form.quotaMaxStorageMB) payload.quotaMaxStorageMB = Number(form.quotaMaxStorageMB);

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
      setError(json.error ?? "Erreur à la création.");
    }
  }

  const canSubmit = form.name.trim() && form.ownerEmail.trim() && !submitting;

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      {error && (
        <Alert tone="err">
          <Icon name="alert-triangle" size={16} /> {error}
        </Alert>
      )}

      <Card>
        <div className="px-6">
          <FormSection title="Organisation" description="Identité et quotas de l'organisation.">
            <div className="space-y-4">
              <Input label="Nom de l'organisation" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              <Input
                label="Slug (optionnel — généré depuis le nom si vide)"
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="acme-corp"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input
                  label="Quota événements"
                  type="number"
                  value={form.quotaMaxEvents}
                  onChange={(e) => set("quotaMaxEvents", e.target.value)}
                />
                <Input
                  label="Quota inscriptions"
                  type="number"
                  value={form.quotaMaxRegistrations}
                  onChange={(e) => set("quotaMaxRegistrations", e.target.value)}
                />
                <Input
                  label="Quota stockage (Mo)"
                  type="number"
                  value={form.quotaMaxStorageMB}
                  onChange={(e) => set("quotaMaxStorageMB", e.target.value)}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="OWNER initial"
            description="Un utilisateur sera créé (s'il n'existe pas) et recevra un e-mail d'invitation pour définir son mot de passe."
          >
            <div className="space-y-4">
              <Input
                label="E-mail du OWNER"
                type="email"
                value={form.ownerEmail}
                onChange={(e) => set("ownerEmail", e.target.value)}
                required
              />
              <Input
                label="Nom complet du OWNER (optionnel)"
                value={form.ownerName}
                onChange={(e) => set("ownerName", e.target.value)}
              />
            </div>
          </FormSection>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.push("/staff/organizations")}>
          Annuler
        </Button>
        <Button type="submit" className="flex items-center justify-center gap-2" disabled={!canSubmit}>
          {submitting ? (
            <>
              <Spinner size={16} /> Création…
            </>
          ) : (
            "Créer l'organisation"
          )}
        </Button>
      </div>
    </form>
  );
}
