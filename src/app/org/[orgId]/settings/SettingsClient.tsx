"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { FormSection } from "@/components/ui/FormControls";
import { Dropzone, FileBox } from "@/components/ui/FileBox";
import { Icon } from "@/components/ui/Icon";
import { toastApiError } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";

type OrgForm = {
  name: string;
  legalName: string | null;
  slug: string;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  taxId: string | null;
  website: string | null;
  logo: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export function SettingsClient({
  orgId,
  initialOrg,
}: {
  orgId: string;
  initialOrg: OrgForm;
}) {
  const [org, setOrg] = useState<OrgForm>(initialOrg);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  function set<K extends keyof OrgForm>(key: K, value: OrgForm[K]) {
    setOrg((o) => ({ ...o, [key]: value }));
  }

  async function uploadLogo(files: FileList) {
    const file = files[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/org/${orgId}/upload`, { method: "POST", body: fd });
      if (!res.ok) throw res;
      const { storageKey } = await res.json();
      set("logo", storageKey);
    } catch (err) {
      // L'indicateur « Envoi… » sert de loader ; la FileBox affiche le succès.
      await toastApiError(err, "Échec de l'envoi du logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  const save = useAsyncAction(
    async () => {
      const res = await fetch(`/api/org/${orgId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: org.name,
          legalName: org.legalName,
          addressLine1: org.addressLine1,
          addressLine2: org.addressLine2,
          postalCode: org.postalCode,
          city: org.city,
          country: org.country,
          taxId: org.taxId,
          website: org.website,
          logo: org.logo,
          contactEmail: org.contactEmail,
          contactPhone: org.contactPhone,
        }),
      });
      if (!res.ok) throw res;
    },
    { success: "Paramètres enregistrés.", error: "Erreur lors de l'enregistrement." },
  );

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Paramètres de l&apos;organisation</h1>
        <p className="mt-0.5 text-sm text-slate-400">Identité, adresse et contact public</p>
      </div>
      <Link
        href={`/org/${orgId}/settings/badge`}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-green-500 hover:text-green-700"
      >
        <Icon name="id-card" size={16} /> Modèle de badge par défaut
      </Link>

      <Card>
        <div className="px-6">
          <FormSection title="Identité">
            <div className="space-y-4">
              <Input label="Nom" value={org.name} onChange={(e) => set("name", e.target.value)} />
              <Input
                label="Raison sociale"
                value={org.legalName ?? ""}
                onChange={(e) => set("legalName", e.target.value || null)}
              />
              <div>
                <Input label="Slug" value={org.slug} disabled />
                <p className="mt-1 text-xs text-slate-400">Modifiable par le staff uniquement.</p>
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">Logo</span>
                {org.logo ? (
                  <FileBox
                    icon="file"
                    thumbUrl={`/api/files/${org.logo}`}
                    title="Logo de l'organisation"
                    subtitle={org.logo}
                    action={
                      <Button type="button" variant="secondary" onClick={() => set("logo", null)}>
                        Retirer
                      </Button>
                    }
                  />
                ) : (
                  <Dropzone
                    onFiles={uploadLogo}
                    accept="image/jpeg,image/png,image/webp"
                    title={uploadingLogo ? "Envoi…" : "Déposer un logo ou cliquer"}
                    subtitle="JPEG, PNG ou WebP — 5 Mo max"
                  />
                )}
              </div>
            </div>
          </FormSection>

          <FormSection title="Adresse">
            <div className="space-y-4">
              <Input
                label="Ligne 1"
                value={org.addressLine1 ?? ""}
                onChange={(e) => set("addressLine1", e.target.value || null)}
              />
              <Input
                label="Ligne 2"
                value={org.addressLine2 ?? ""}
                onChange={(e) => set("addressLine2", e.target.value || null)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Code postal"
                  value={org.postalCode ?? ""}
                  onChange={(e) => set("postalCode", e.target.value || null)}
                />
                <Input label="Ville" value={org.city ?? ""} onChange={(e) => set("city", e.target.value || null)} />
              </div>
              <Input label="Pays" value={org.country ?? ""} onChange={(e) => set("country", e.target.value || null)} />
            </div>
          </FormSection>

          <FormSection title="Administratif">
            <div className="space-y-4">
              <Input
                label="Numéro fiscal / SIRET"
                value={org.taxId ?? ""}
                onChange={(e) => set("taxId", e.target.value || null)}
              />
              <Input
                label="Site web"
                placeholder="https://exemple.fr"
                value={org.website ?? ""}
                onChange={(e) => set("website", e.target.value || null)}
              />
            </div>
          </FormSection>

          <FormSection title="Contact public">
            <div className="space-y-4">
              <Input
                label="E-mail de contact"
                placeholder="contact@exemple.fr"
                value={org.contactEmail ?? ""}
                onChange={(e) => set("contactEmail", e.target.value || null)}
              />
              <Input
                label="Téléphone"
                placeholder="+33 1 23 45 67 89"
                value={org.contactPhone ?? ""}
                onChange={(e) => set("contactPhone", e.target.value || null)}
              />
            </div>
          </FormSection>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => setOrg(initialOrg)}>
          Annuler
        </Button>
        <Button onClick={save.run} loading={save.pending}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
