"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof OrgForm>(key: K, value: OrgForm[K]) {
    setOrg((o) => ({ ...o, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/${orgId}`, {
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
    setSaving(false);
    if (res.ok) {
      setMsg("Paramètres enregistrés.");
    } else {
      setMsg("Erreur lors de l'enregistrement.");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Paramètres de l&apos;organisation</h1>
      {msg && (
        <div className="rounded bg-blue-50 border border-blue-200 px-3 py-2 text-sm">{msg}</div>
      )}

      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">Identité</h2>
        <div>
          <label className="text-sm text-slate-600">Nom</label>
          <Input value={org.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-slate-600">Raison sociale</label>
          <Input
            value={org.legalName ?? ""}
            onChange={(e) => set("legalName", e.target.value || null)}
          />
        </div>
        <div>
          <label className="text-sm text-slate-600">Slug</label>
          <Input value={org.slug} disabled />
          <p className="text-xs text-slate-500 mt-1">Modifiable par le staff uniquement.</p>
        </div>
        <div>
          <label className="text-sm text-slate-600">Logo (URL)</label>
          <Input
            placeholder="/uploads/logo.png"
            value={org.logo ?? ""}
            onChange={(e) => set("logo", e.target.value || null)}
          />
        </div>
      </section>

      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">Adresse</h2>
        <Input
          placeholder="Ligne 1"
          value={org.addressLine1 ?? ""}
          onChange={(e) => set("addressLine1", e.target.value || null)}
        />
        <Input
          placeholder="Ligne 2"
          value={org.addressLine2 ?? ""}
          onChange={(e) => set("addressLine2", e.target.value || null)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder="Code postal"
            value={org.postalCode ?? ""}
            onChange={(e) => set("postalCode", e.target.value || null)}
          />
          <Input
            placeholder="Ville"
            value={org.city ?? ""}
            onChange={(e) => set("city", e.target.value || null)}
          />
        </div>
        <Input
          placeholder="Pays"
          value={org.country ?? ""}
          onChange={(e) => set("country", e.target.value || null)}
        />
      </section>

      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">Administratif</h2>
        <div>
          <label className="text-sm text-slate-600">Numéro fiscal / SIRET</label>
          <Input value={org.taxId ?? ""} onChange={(e) => set("taxId", e.target.value || null)} />
        </div>
        <div>
          <label className="text-sm text-slate-600">Site web</label>
          <Input
            placeholder="https://exemple.fr"
            value={org.website ?? ""}
            onChange={(e) => set("website", e.target.value || null)}
          />
        </div>
      </section>

      <section className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-semibold">Contact public</h2>
        <Input
          placeholder="contact@exemple.fr"
          value={org.contactEmail ?? ""}
          onChange={(e) => set("contactEmail", e.target.value || null)}
        />
        <Input
          placeholder="+33 1 23 45 67 89"
          value={org.contactPhone ?? ""}
          onChange={(e) => set("contactPhone", e.target.value || null)}
        />
      </section>

      <Button onClick={save} disabled={saving}>
        Enregistrer
      </Button>
    </div>
  );
}
