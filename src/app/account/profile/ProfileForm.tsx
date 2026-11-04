"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormSection } from "@/components/ui/FormControls";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import { useCropFlow } from "@/components/ui/ImageCropper";
import { IdPhotoRules } from "@/components/account/IdPhotoRules";
import { ID_PHOTO_REQUIREMENT } from "@/lib/badge-templates/image-frames";
import { toastApiError, toastSuccess } from "@/lib/toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";

type Props = {
  initial: {
    firstName: string | null;
    lastName: string | null;
    structure: string | null;
    photo: string | null;
    idDocumentType: string | null;
    idDocumentNumber: string | null;
    idDocument: string | null;
  };
  redirectTo?: string;
};

const ID_DOC_TYPES = ["CNI", "Passeport", "Permis", "Autre"];

export default function ProfileForm({ initial, redirectTo }: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial.firstName ?? "");
  const [lastName, setLastName] = useState(initial.lastName ?? "");
  const [structure, setStructure] = useState(initial.structure ?? "");
  const [photo, setPhoto] = useState(initial.photo ?? "");
  const [idDocumentType, setIdDocumentType] = useState(initial.idDocumentType ?? "CNI");
  const [idDocumentNumber, setIdDocumentNumber] = useState(initial.idDocumentNumber ?? "");
  const [idDocument, setIdDocument] = useState(initial.idDocument ?? "");
  const [navigating, setNavigating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Motif F : « Envoi en cours… » sert de loader, la prévisualisation affiche le succès ;
  // seule l'erreur donne un toast.
  async function uploadFile(file: File, kind: "photo" | "document"): Promise<string | null> {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/account/upload?kind=${kind}`, { method: "POST", body: fd });
      if (!res.ok) throw res;
      const data = await res.json();
      return data.storageKey as string;
    } catch (err) {
      await toastApiError(err, "Erreur d'upload.");
      return null;
    }
  }

  async function uploadPhoto(file: File) {
    setUploadingPhoto(true);
    const key = await uploadFile(file, "photo");
    setUploadingPhoto(false);
    if (key) setPhoto(key);
  }
  const photoFlow = useCropFlow(ID_PHOTO_REQUIREMENT, "Recadrer la photo", uploadPhoto);

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const f = input.files?.[0];
    await photoFlow.choose(f);
    // Permet de rechoisir le meme fichier apres un refus.
    input.value = "";
  }

  async function handleDoc(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingDoc(true);
    const key = await uploadFile(f, "document");
    setUploadingDoc(false);
    if (key) setIdDocument(key);
  }

  const save = useAsyncAction(
    async () => {
      // On omet les chaines vides : le Zod schema cote API exige min(1) et
      // refuserait sinon. Cela permet une sauvegarde partielle (ex : avant
      // d'avoir upload la photo).
      const payload: Record<string, string> = {};
      if (firstName.trim()) payload.firstName = firstName;
      if (lastName.trim()) payload.lastName = lastName;
      if (structure.trim()) payload.structure = structure;
      if (photo.trim()) payload.photo = photo;
      if (idDocumentType.trim()) payload.idDocumentType = idDocumentType;
      if (idDocumentNumber.trim()) payload.idDocumentNumber = idDocumentNumber;
      if (idDocument.trim()) payload.idDocument = idDocument;

      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw res;
    },
    {
      error: "Erreur de mise à jour.",
      // Avec redirectTo, la page d'arrivée montre le résultat : pas de toast.
      onSuccess: () => {
        if (redirectTo) {
          setNavigating(true);
          router.push(redirectTo);
        } else {
          toastSuccess("Profil enregistré.");
          router.refresh();
        }
      },
    },
  );
  const saving = save.pending || navigating;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save.run();
      }}
      className="rounded-xl border border-slate-200 bg-white px-6"
    >
      <FormSection title="Identité" description="Ces informations figureront sur votre badge.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Prénom" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <Input label="Nom" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
        <Input
          label="Structure (entreprise, école, organisation)"
          type="text"
          value={structure}
          onChange={(e) => setStructure(e.target.value)}
          required
        />
      </FormSection>

      <FormSection title="Photo" description="JPEG, PNG ou WebP — 5 Mo maximum — format photo d'identité 7:9.">
        <IdPhotoRules />
        {photo ? (
          <div className="mb-3 space-y-1">
            <DocumentPreview storageKey={photo} label="Photo enregistrée" />
            <Button
              type="button"
              variant="secondary"
              disabled={uploadingPhoto}
              onClick={() => photoFlow.recrop(`/api/files/${photo}`)}
            >
              Recadrer
            </Button>
            {uploadingPhoto && <p className="text-xs text-slate-500">Envoi en cours…</p>}
          </div>
        ) : null}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhoto}
          disabled={uploadingPhoto}
          className="block text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        {uploadingPhoto && <p className="mt-1 text-xs text-slate-500">Envoi en cours…</p>}
        {photoFlow.cropper}
      </FormSection>

      <div className="pt-4 text-xs text-slate-500">
        Toute modification de la photo ou de la pièce d&apos;identité relance la vérification par la plateforme.
      </div>

      <FormSection title="Pièce d'identité" description="Type, numéro et justificatif.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Type de pièce d&apos;identité</label>
            <select
              value={idDocumentType}
              onChange={(e) => setIdDocumentType(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              {ID_DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Numéro de pièce"
            type="text"
            value={idDocumentNumber}
            onChange={(e) => setIdDocumentNumber(e.target.value)}
            required
          />
        </div>
        {idDocument ? (
          <div className="mb-3 space-y-1">
            <DocumentPreview storageKey={idDocument} label="Pièce d'identité enregistrée" />
            {uploadingDoc && <p className="text-xs text-slate-500">Envoi en cours…</p>}
          </div>
        ) : null}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleDoc}
          disabled={uploadingDoc}
          className="block text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        {uploadingDoc && <p className="mt-1 text-xs text-slate-500">Envoi en cours…</p>}
      </FormSection>

      <div className="flex justify-end py-6">
        <Button type="submit" loading={saving} disabled={uploadingPhoto || uploadingDoc}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
