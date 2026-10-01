"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dropzone, FileBox } from "@/components/ui/FileBox";
import { Card } from "@/components/ui/Card";
import { FormSection } from "@/components/ui/FormControls";
import { RadioCards } from "@/components/ui/RadioCards";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { Icon } from "@/components/ui/Icon";

type Category = { id: string; name: string; number: number };

const SELECT_CLASS =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500";

export function RegistrationForm({
  orgId,
  eventId,
  categories,
  initial,
}: {
  orgId: string;
  eventId: string;
  categories: Category[];
  initial?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    structure: string;
    categoryId: string;
    idDocumentType: string;
    idDocumentNumber: string;
    photo: string | null;
    idDocument: string | null;
  };
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [structure, setStructure] = useState(initial?.structure ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [idDocumentType, setIdDocumentType] = useState(initial?.idDocumentType ?? "CNI");
  const [idDocumentNumber, setIdDocumentNumber] = useState(initial?.idDocumentNumber ?? "");
  const [photo, setPhoto] = useState<string | null>(initial?.photo ?? null);
  const [idDocument, setIdDocument] = useState<string | null>(initial?.idDocument ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"photo" | "document" | null>(null);

  async function uploadReg(
    kind: "photo" | "document",
    files: FileList,
    setter: (key: string) => void,
  ) {
    const file = files[0];
    if (!file) return;
    setUploading(kind);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/org/${orgId}/events/${eventId}/upload?kind=${kind}`, {
      method: "POST",
      body: fd,
    });
    setUploading(null);
    if (!res.ok) {
      setErr("Échec de l'envoi du fichier.");
      return;
    }
    const { storageKey } = await res.json();
    setter(storageKey);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const url = initial
      ? `/api/org/${orgId}/events/${eventId}/registrations/${initial.id}`
      : `/api/org/${orgId}/events/${eventId}/registrations`;
    const res = await fetch(url, {
      method: initial ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        structure,
        categoryId,
        idDocumentType,
        idDocumentNumber,
        photo,
        idDocument,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Échec de l'enregistrement.");
      setBusy(false);
      return;
    }
    const json = await res.json();
    router.push(`/event/${eventId}/registrations/${initial?.id ?? json.registration.id}`);
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      {err && (
        <Alert tone="err">
          <Icon name="alert-triangle" size={16} /> {err}
        </Alert>
      )}
      <Card>
        <div className="px-6">
          <FormSection title="Identité">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
              <Input label="Adresse e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input
                label="Structure / organisation"
                value={structure}
                onChange={(e) => setStructure(e.target.value)}
                required
              />
            </div>
          </FormSection>

          <FormSection title="Catégorie">
            <RadioCards
              name="Catégorie"
              value={categoryId || null}
              onChange={setCategoryId}
              options={categories.map((c) => ({ value: c.id, title: `#${c.number} — ${c.name}` }))}
            />
          </FormSection>

          <FormSection title="Pièce d'identité">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Type</span>
                  <select value={idDocumentType} onChange={(e) => setIdDocumentType(e.target.value)} className={SELECT_CLASS}>
                    <option value="CNI">CNI</option>
                    <option value="PASSPORT">Passeport</option>
                    <option value="DRIVER_LICENSE">Permis de conduire</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </label>
                <Input
                  label="Numéro de pièce"
                  value={idDocumentNumber}
                  onChange={(e) => setIdDocumentNumber(e.target.value)}
                  required
                />
              </div>
              <RegFileField
                label="Photo"
                storageKey={photo}
                accept="image/jpeg,image/png,image/webp"
                uploading={uploading === "photo"}
                onUpload={(files) => uploadReg("photo", files, setPhoto)}
                onClear={() => setPhoto(null)}
              />
              <RegFileField
                label="Pièce d'identité"
                storageKey={idDocument}
                accept="image/jpeg,image/png,image/webp,application/pdf"
                uploading={uploading === "document"}
                onUpload={(files) => uploadReg("document", files, setIdDocument)}
                onClear={() => setIdDocument(null)}
              />
            </div>
          </FormSection>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" className="flex items-center justify-center gap-2" disabled={busy}>
          {busy ? (
            <>
              <Spinner size={16} /> Enregistrement…
            </>
          ) : initial ? (
            "Mettre à jour"
          ) : (
            "Créer l'inscription"
          )}
        </Button>
      </div>
    </form>
  );
}

function RegFileField({
  label,
  storageKey,
  accept,
  uploading,
  onUpload,
  onClear,
}: {
  label: string;
  storageKey: string | null;
  accept: string;
  uploading: boolean;
  onUpload: (files: FileList) => void;
  onClear: () => void;
}) {
  const isPdf = accept.includes("pdf");
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      {storageKey ? (
        <FileBox
          icon="file"
          thumbUrl={isPdf ? undefined : `/api/files/${storageKey}`}
          title={label}
          subtitle={storageKey}
          action={
            <Button type="button" variant="secondary" onClick={onClear}>
              Retirer
            </Button>
          }
        />
      ) : (
        <Dropzone
          onFiles={onUpload}
          accept={accept}
          title={uploading ? "Envoi…" : "Déposer un fichier ou cliquer"}
          subtitle="5 Mo max"
        />
      )}
    </div>
  );
}
