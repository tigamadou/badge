"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dropzone, FileBox } from "@/components/ui/FileBox";
import { Card } from "@/components/ui/Card";
import { FormSection } from "@/components/ui/FormControls";
import { RadioCards } from "@/components/ui/RadioCards";
import { ActionError, toastApiError } from "@/lib/toast";
import { useCropFlow } from "@/components/ui/ImageCropper";
import { IdPhotoRules } from "@/components/account/IdPhotoRules";
import { ID_PHOTO_REQUIREMENT } from "@/lib/badge-templates/image-frames";
import { useAsyncAction } from "@/hooks/useAsyncAction";

type Category = { id: string; name: string; number: number };

type FieldName = "firstName" | "lastName" | "email" | "structure" | "idDocumentNumber";
type FieldErrors = Partial<Record<FieldName, string>>;
const FIELD_NAMES: readonly string[] = ["firstName", "lastName", "email", "structure", "idDocumentNumber"];

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [navigating, setNavigating] = useState(false);
  const [uploading, setUploading] = useState<"photo" | "document" | null>(null);

  async function uploadReg(
    kind: "photo" | "document",
    file: File | undefined,
    setter: (key: string) => void,
  ) {
    if (!file) return;
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/org/${orgId}/events/${eventId}/upload?kind=${kind}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw res;
      const { storageKey } = await res.json();
      setter(storageKey);
    } catch (err) {
      // L'indicateur « Envoi… » sert de loader ; la FileBox affiche le succès.
      await toastApiError(err, "Échec de l'envoi du fichier.");
    } finally {
      setUploading(null);
    }
  }

  const photoFlow = useCropFlow(ID_PHOTO_REQUIREMENT, "Recadrer la photo", (file) =>
    uploadReg("photo", file, setPhoto),
  );

  // Motif C + D : les `issues` rattachées à un champ s'affichent sous ce champ, le reste en toast.
  // Pas de toast de succès : la fiche de l'inscription s'affiche.
  const save = useAsyncAction(
    async (): Promise<{ id?: string; fieldErrors?: FieldErrors }> => {
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
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          issues?: { path?: (string | number)[] }[];
        };
        if (j.error === "ALREADY_REGISTERED") {
          throw new ActionError("Cette personne est déjà inscrite à cet événement.");
        }
        const errors: FieldErrors = {};
        for (const issue of j.issues ?? []) {
          const field = issue.path?.[0];
          if (typeof field === "string" && FIELD_NAMES.includes(field)) {
            errors[field as FieldName] = "Valeur invalide.";
          }
        }
        if (Object.keys(errors).length > 0) return { fieldErrors: errors };
        throw new ActionError("Échec de l'enregistrement.");
      }
      const json = await res.json();
      return { id: initial?.id ?? json.registration.id };
    },
    {
      onSuccess: (result) => {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
          return;
        }
        setNavigating(true);
        router.push(`/event/${eventId}/registrations/${result.id}`);
      },
    },
  );
  const busy = save.pending || navigating;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setFieldErrors({});
        void save.run();
      }}
      className="max-w-2xl space-y-4"
    >
      <Card>
        <div className="px-6">
          <FormSection title="Identité">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Prénom" value={firstName} error={fieldErrors.firstName} onChange={(e) => setFirstName(e.target.value)} required />
                <Input label="Nom" value={lastName} error={fieldErrors.lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
              <Input
                label="Adresse e-mail"
                type="email"
                value={email}
                error={fieldErrors.email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Structure / organisation"
                value={structure}
                error={fieldErrors.structure}
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
                  error={fieldErrors.idDocumentNumber}
                  onChange={(e) => setIdDocumentNumber(e.target.value)}
                  required
                />
              </div>
              <RegFileField
                label="Photo"
                storageKey={photo}
                accept="image/jpeg,image/png,image/webp"
                uploading={uploading === "photo"}
                onUpload={(files) => photoFlow.choose(files[0])}
                onClear={() => setPhoto(null)}
                above={<IdPhotoRules />}
                onRecrop={photo ? () => photoFlow.recrop(`/api/files/${photo}`) : undefined}
                below={photoFlow.cropper}
              />
              <RegFileField
                label="Pièce d'identité"
                storageKey={idDocument}
                accept="image/jpeg,image/png,image/webp,application/pdf"
                uploading={uploading === "document"}
                onUpload={(files) => uploadReg("document", files[0], setIdDocument)}
                onClear={() => setIdDocument(null)}
              />
            </div>
          </FormSection>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={busy}>
          {initial ? "Mettre à jour" : "Créer l'inscription"}
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
  above,
  below,
  onRecrop,
}: {
  label: string;
  storageKey: string | null;
  accept: string;
  uploading: boolean;
  onUpload: (files: FileList) => void;
  onClear: () => void;
  above?: ReactNode;
  below?: ReactNode;
  onRecrop?: () => void;
}) {
  const isPdf = accept.includes("pdf");
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      {above}
      {storageKey ? (
        <FileBox
          icon="file"
          thumbUrl={isPdf ? undefined : `/api/files/${storageKey}`}
          title={label}
          subtitle={storageKey}
          action={
            <div className="flex flex-wrap justify-end gap-2">
              {onRecrop ? (
                <Button type="button" variant="secondary" onClick={onRecrop} disabled={uploading}>
                  Recadrer
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={onClear}>
                Retirer
              </Button>
            </div>
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
      {below}
    </div>
  );
}
